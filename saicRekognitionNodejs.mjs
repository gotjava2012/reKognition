const AWS = require('aws-sdk');
/**
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Rekognition.html#detectFaces-property
 */

// Setup Rekognition and S3 clients
const rekognition = new AWS.Rekognition({ apiVersion: '2016-06-27', region: 'us-west-1' });
const s3 = new AWS.S3();

// Get all images from bucket
async function getS3ObjectsInBucket(bucket) {
    const listObjectsParams = {
        Bucket: bucket
    };

    let s3Objects;

    try {
        s3Objects = await s3.listObjectsV2(listObjectsParams).promise();
    }
    catch (e) {
        console.log(e)
    }

    const {Contents} = s3Objects;
    return Contents;
}

function detectFaces(bucket, targetImageName) {
    /**
     * DetectFaces detects the 100 largest faces in the image. 
     * For each face detected, the operation returns face details. 
     * These details include a bounding box of the face, a confidence 
     * value (that the bounding box contains a face), and a fixed set of 
     * attributes such as facial landmarks (for example, coordinates of 
     * eye and mouth), presence of beard, sunglasses, and so on.
     */
    var params = {
        Image: { /* required */
            S3Object: {
              Bucket: bucket,
              Name: targetImageName,
            }
        },
        Attributes: ['ALL']
    };
    
    return new Promise((resolve, reject) => {
        rekognition.detectFaces(params, function(err, data) {
          if (err) {
              console.log(err, err.stack); // an error occurred
              reject(err);
          } else {
              console.log('DETECT FACES', targetImageName, data);   
              resolve(data)// successful response
          }
        });
    });
}

function createCollection(collectionId) {
    /**
     * Creates a collection in an AWS Region. You can add faces to the collection using the IndexFaces operation.
     */
    var params = {
        CollectionId: collectionId
    };
    return new Promise((resolve, reject) => {
        rekognition.createCollection(params, function(err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
                reject(err);
            } else  { 
                console.log('createCollection', data);
                resolve(data)// successful response
            }
        });
    });
}

function deleteCollection(collectionId) {
    var params = {
        CollectionId: collectionId
    };
    
    return new Promise((resolve, reject) => {
        rekognition.deleteCollection(params, function(err, data) {
            if (err) {
              console.log(err, err.stack); // an error occurred
            }  else {
              console.log(data);           // successful response
              resolve('DELETE COLLECTION', data);
            }
        });
    }); 
}

function indexFaces(collectionId, bucket, targetImageName) {
    /**
     * Detects faces in the input image and adds them to the specified collection.
     **/
    return new Promise((resolve, reject) => {
        
        var params = {
            CollectionId: collectionId, /* required */
            Image: { /* required */
                S3Object: {
                  Bucket: bucket,
                  Name: targetImageName,

                }
            },
            DetectionAttributes: ['ALL'],
            ExternalImageId: `${new Date().getTime()}`,
        };
            
        rekognition.indexFaces(params, function(err, data) {
            
            if (err) {
                console.log(err, err.stack); // an error occurred
                reject(err);
            }
            else {
                data.targetImageName = targetImageName;
                console.log('indexFaces', data);    
                resolve(data);
            }
        });
    });
}

function searchFacesByImage(collectionId, bucket, targetImageName) {
    /** 
     * The response returns an array of faces that match, ordered by similarity score with the highest similarity first. 
     * More specifically, it is an array of metadata for each face match found. 
     * Along with the metadata, the response also includes a similarity indicating 
     * how similar the face is to the input face.
    **/  
    return new Promise((resolve, reject) => {
     
        var params = {
            CollectionId: collectionId, /* required */
            FaceMatchThreshold: 70,
            Image: { /* required */
                S3Object: {
                  Bucket: bucket,
                  Name: targetImageName,
                }
            },
        };
            
        rekognition.searchFacesByImage(params, function(err, data) {
            
            if (err) {
                console.log(err, err.stack); // an error occurred
                reject(err);
            }
            else {
                data.targetImageName = targetImageName;
                console.log('searchFaces', data);    
                resolve(data);
            }
        });
    });
}

function listFaces(collectionId) {
/**
 * Returns metadata for faces in the specified collection. 
 * This metadata includes information such as the bounding box coordinates, 
 * the confidence (that the bounding box contains a face), and face ID.
 **/
    var params = {
        CollectionId: collectionId
    };
    
    return new Promise((resolve, reject) => {
       
        rekognition.listFaces(params, function(err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
                reject(err)
            } else {
                console.log('listFaces', data);           // successful response
                resolve(data);
            }
        });
    });

}

// compare faces
async function compareFaces(sourceBufferImage, bucket, targetImageName) {
    /**
     * Compares a face in the source input image with each of the 100 largest faces detected in the target input image.
     */
    const params = {
        SourceImage: {
            Bytes: sourceBufferImage //Blob of image bytes up to 5 MBs.
        },
        TargetImage: {
            S3Object: { //Identifies an S3 object as the image source.
                Bucket: bucket, //Name of the S3 bucket.
                Name: targetImageName //S3 object key name.
            }
        }
    };

    return new Promise((resolve, reject) => {
        rekognition.compareFaces(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                data.targetImageName = targetImageName;
                resolve(data);
            }
        });
    });
}

exports.handler = async (event, context, callback) => {
    // grabbing the incoming image from the event
    const {
        ImageData
    } = event;

    // creating a buffer out of the incoming base64 image
    const buffer = Buffer.from(ImageData, 'base64');

    // S3 Images Bucket
    const bucket = 'saicbucket';


    // Get all image objects from bucket
    const imagesCollection = await getS3ObjectsInBucket(bucket);

    const collectionId = 'saicFacesCollection';

    
    
    // Map images to promises that call compareFaces API
    const compareFacesImagesCollectionsPromises = imagesCollection.map(image => compareFaces(buffer, bucket, image.Key));
    const detectFacesImagesCollectionsPromises = imagesCollection.map(image => detectFaces(bucket, image.Key));
    const indexFacesImagesCollectionsPromises = imagesCollection.map(image => indexFaces(collectionId, bucket, image.Key));
    const searchFacesByImageCollectionsPromises = imagesCollection.map(image => searchFacesByImage(collectionId, bucket, image.Key));

    const compareFacesResults = await Promise.all(compareFacesImagesCollectionsPromises);

    
    // https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html
    callback(null, {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Headers" : "Content-Type",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
        },
        "body": JSON.stringify({
            status: 'SUCCESS',
            message: '',
            data: {
                compareFacesResults
            }
        })
    });

};
