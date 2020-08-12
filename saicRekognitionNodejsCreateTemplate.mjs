const AWS = require('aws-sdk');

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

function indexFacesWithBase64EncodedImageString(collectionId, buffer, ImageData) {
    
        const params = {
            CollectionId: collectionId, /* required */
            Image: { /* required */
                Bytes: buffer
            },
            DetectionAttributes: ['ALL'],
            ExternalImageId: ImageData,
        };
    
    
    return new Promise((resolve, reject) => {
        
        rekognition.indexFaces(params, function(err, data) {
            
            if (err) {
                console.log(err, err.stack); // an error occurred
                reject(err);
            }
            else {
                console.log('indexFaces', data);    
                resolve(data);
            }
        });
        
    });
    
}

function indexFaces(collectionId, bucket, targetImageName) {
    
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
            ExternalImageId: targetImageName,
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
    const params = {
        // SimilarityThreshold: 80,
        SourceImage: {
            Bytes: sourceBufferImage
        },
        TargetImage: {
            S3Object: {
                Bucket: bucket,
                Name: targetImageName
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
    
    const bufferIndexFacesResult = await indexFacesWithBase64EncodedImageString(collectionId, buffer, ImageData);
    const indexFacesImagesCollectionsPromises = imagesCollection.map(image => indexFaces(collectionId, bucket, image.Key));
    const indexFacesResults = await Promise.all(indexFacesImagesCollectionsPromises);
    console.log('@@@', indexFacesResults.map(i => i.FaceRecords[0].Face))
    const templateId = indexFacesResults[0].FaceRecords[0].Face.FaceId;
    
    // https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html
    callback(null, {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Headers" : "Content-Type",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
        },
        "body": JSON.stringify({
                Template: templateId
            })
    });

};
