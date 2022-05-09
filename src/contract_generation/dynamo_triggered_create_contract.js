'use strict'
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const sns = new AWS.SNS();
var docClient = new AWS.DynamoDB.DocumentClient();
var fs = require('fs');

const db = require("src/websocket/db");

const ws = require("src/websocket/websocket-client");
const wsClient = new ws.Client();

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
};

const TEMPLATE_BUCKET_NAME = process.env.TEMPLATE_CONTRACT_BUCKET_NAME;
const GENERATED_BUCKET_NAME = process.env.GENERATED_CONTRACT_BUCKET_NAME;

module.exports.handler = (event, context) => {
    console.log('Event: ', event);

    event.Records.forEach( async (record) => {
        console.log('Stream record: ', JSON.stringify(record, null, 2));
        
        if (record.eventName != 'REMOVE'){
            if (record.eventName == 'INSERT' || record['dynamodb']['OldImage']['timestamp']['S'] !== record['dynamodb']['NewImage']['timestamp']['S']) {
                try {

                        
                    const id = record['dynamodb']['NewImage']['id']['S'];
                    const chain = record['dynamodb']['NewImage']['chain']['S']
                    const params = record['dynamodb']['NewImage']['parameters']['M'];
                    const nameNoSpace = params["tokenName"]["S"].replace(/\s/g, '');
                    console.log(TEMPLATE_BUCKET_NAME);
                    const Bucket = TEMPLATE_BUCKET_NAME;
                    var text = "";

                    // Define the headers
                    const headers = [
                        "// SPDX-License-Identifier: No License",
                        "pragma solidity ^0.8.4;",
                        ""
                    ];

                    // Define the import statements
                    const imports = [
                        "import \"@openzeppelin/contracts/token/ERC20/ERC20.sol\";",
                        ""
                    ];
                    if (record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S'].includes('Mint')) {
                        imports.splice(
                            1,
                            0,
                          'import "@openzeppelin/contracts/access/AccessControl.sol";'
                        );
                    }
                    if (
                      record["dynamodb"]["NewImage"]["parameters"]["M"][
                        "selectedFunctions"
                      ]["S"].includes("Burn")
                    ) {
                      imports.splice(
                        1,
                        0,
                        'import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burn.sol";'
                      );
                    }

                    // Define the contract
                    const types = ["ERC20"];
                    if (
                      record["dynamodb"]["NewImage"]["parameters"]["M"][
                        "selectedFunctions"
                      ]["S"].includes("Mint")
                    ) {
                      types.splice(
                          1,
                          0,
                        'AccessControl'
                      );
                    }
                    if (
                      record["dynamodb"]["NewImage"]["parameters"]["M"][
                        "selectedFunctions"
                      ]["S"].includes("Burn")
                    ) {
                      types.splice(1, 0, "ERC20Burn");
                    }
                    const typesText = types.join(", ");
                    const definition = `contract ${nameNoSpace} is ${typesText} {`

                    // Constants
                    const constants = [];
                    if (
                      record["dynamodb"]["NewImage"]["parameters"]["M"][
                        "selectedFunctions"
                      ]["S"].includes("Mint")
                    ) {
                      constants.splice(
                          0,
                          0,
                        'bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");'
                      );
                    }
                    
                    // Functions

                    // Constructor
                    const functions = [
                        `     constructor() ERC20("${params["tokenName"]["S"]}", "${params["tokenSymbol"]["S"]}") {`,
                        `          _mint(msg.sender, ${params["totalSupply"]["N"]} * 10 ** ${params["decimals"]["N"]});`,
                        "     }",
                        ""
                    ];
                    if (
                      record["dynamodb"]["NewImage"]["parameters"]["M"][
                        "selectedFunctions"
                      ]["S"].includes("Mint")
                    ) {
                      functions.splice(
                          2,
                          0,
                        "          _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);",
                        "          _grantRole(MINTER_ROLE, msg.sender);"
                      );
                    }

                    // Other functions
                    if (
                      record["dynamodb"]["NewImage"]["parameters"]["M"][
                        "selectedFunctions"
                      ]["S"].includes("Mint")
                    ) {
                      functions.push.apply(functions,[
                        "     function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {",
                        "          _mint(to, amount);",
                          "     }",
                        ""
                      ]);
                    }
                    if (params["decimals"]["N"] != 18) {
                        functions.push.apply(functions, [
                          "     function decimals() public view virtual override returns (uint8) {",
                          `          return ${params["decimals"]["N"]};`,
                          "     }",
                        ]);
                    }


                    // Skeleton
                    const content = headers.concat(imports, definition, constants, functions, "}");

                    text = content.join("\n");
                    
                    try {
                        console.log("text2: ", text);
                        updateRequestTableGenerated(id);
                        const upload_params = {
                            Bucket: GENERATED_BUCKET_NAME,
                            Key: `${id}.sol`,
                            Body: text,
                        };
                        const upload_data = await s3.upload(upload_params).promise();
                        console.log('upload data:', JSON.stringify(upload_data));
                        const subscribers = await db.fetchContractRequestSubscriptions(id);
                        console.log('subscribers: ', JSON.stringify(subscribers));
                        const results = subscribers.map(subscriber => {
                            const subscriberId = db.parseEntityId(
                                subscriber[db.ContractRequest.Connections.Range]
                            );
                            console.log('subscriber: ', subscriber);
                            try {
                            return wsClient.send(subscriberId, {
                                event: "contract_generated",
                                requestId: id,
                            });
                            } catch(err){
                                console.log(err);
                            }
                        });

                        const message = JSON.stringify({
                            'id': id,
                            'chain': chain,
                            'type': record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S'],
                            'name': params["tokenName"]["S"]
                        });
                        const metadata = await publishSnsTopic(message).promise();
                        console.log('metadata: ', JSON.stringify(metadata));
                        await Promise.all(results);
                        
                        return {
                            headers,
                            statusCode: 200,
                            body: JSON.stringify(metadata),
                        };
                    } catch (err) {
                        return(err);
                    }
                    
                } catch (err) {
                    console.log(err, err.stack);
                    return(err);
                }
            }
        }
    });
};

async function publishSnsTopic (message) {
    const params = {
      Message: message,
      TopicArn: `arn:aws:sns:${process.env.API_REGION}:288605598865:${process.env.STACK_STAGE}-compile`
    }
    return sns.publish(params).promise()
}

async function updateRequestTableGenerated (id) {
    var params = {
        TableName:process.env.REQUESTS_TABLE,
        Key:{
            "id": id,
        },
        UpdateExpression: "set generated = :t",
        ExpressionAttributeValues:{
            ":t":true,
        },
        ReturnValues:"UPDATED_NEW"
    };
    
    console.log("Updating the item...");
    docClient.update(params, function(err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
        }
    });
    return true;
}