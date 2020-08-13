import json

def lambda_handler(event, context):
    
    response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Headers" : "Content-Type",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
        },
        "body": json.dumps({
              "AlgorithmName": "AlwaysTrue",
              "AlgorithmVersion": "1.0.1",
              "AlgorithmType": "Face",
              "CompanyName": "MdTF",
              "TechnicalContactEmail": "john@mdtf.org",
              "RecommendedCPUs": 4,
              "RecommendedMem": 2048
             })
    }
    return response;