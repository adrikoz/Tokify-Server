'use strict';

var fs = require('fs');
var solc = require('solc');

const db = require("src/websocket/db");

const ws = require("src/websocket/websocket-client");
const wsClient = new ws.Client();

const AWS = require('aws-sdk');
const s3= new AWS.S3();
var docClient = new AWS.DynamoDB.DocumentClient();
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
};

const GENERATED_BUCKET_NAME = process.env.GENERATED_CONTRACT_BUCKET_NAME;
const COMPILED_BUCKET_NAME = process.env.COMPILED_CONTRACT_BUCKET_NAME;

module.exports.handler = async (event) => {
    console.log('started function');
    console.log('event: ', JSON.stringify(event));
    console.log('Sns: ', JSON.stringify(event['Records'][0]['Sns']))
    const message = JSON.parse(event['Records'][0]['Sns']['Message']);
    const id = message['id'];
    const chain = message['chain'];
    const type = message['type'];
    const name = message['name'].replace(/\s/g, '');
    try {
        console.log(GENERATED_BUCKET_NAME);
        const Bucket = GENERATED_BUCKET_NAME;
        const Key = `${id}.sol`;
        console.log("point 1");
        console.log("key: ", Key);
        const data = await s3.getObject({ Bucket, Key }).promise();
        
        const content = data.Body.toString('ascii');
        console.log("data body: ", content);
        var input = {
            language: "Solidity",
            //version: "0.6.12",
            sources: {
                'contract.sol': {
                    content: content
                }
            },
            settings: { // This is the one that i had missed
                outputSelection: {
                    '*': {
                        '*': [ '*' ]
                    }
                },
                //evmVersion: "0.6.12"
            }
        }

        //console.log('input ' + JSON.stringify(input));
        console.log("point 2");
        const input_string = JSON.stringify(input);
        console.log("point 2a");
        //const solcVersioned = solc.useVersion('v0.6.12+commit.27d51765');
        //const string_output = solc.compile(input_string);
        if (type === 'Rebase') {
            await new Promise((resolve, reject) => {
                solc.loadRemoteVersion('v0.7.4+commit.3f05b770', async function (err, solcSnapshot) {
                    if (err) {
                        console.log('erroring in the callback');
                        resolve();
                        // An error was encountered, display and quit
                    } else {
                        console.log('chilling inside the callback');
                        try {
                            const string_output = solcSnapshot.compile(input_string);
                            console.log('output: ', string_output)
                            await processCompilerOutput(string_output);
                            resolve();
                        } catch (err) {
                            console.log(err);
                            resolve();
                        }
                    }
                });
            });
        } else {
            const string_output = solc.compile(input_string);
            console.log('output: ', string_output)
            await processCompilerOutput(string_output);
        }
    } catch (err) {
        console.log(err, err.stack);
        return(err);
    }

    async function processCompilerOutput (string_output){
        console.log("point 2b");
        var output = JSON.parse(string_output);
        console.log("point 3");
        var contractSelector = '';
        if (type === "Liquidity Generator") {
            contractSelector = 'LiquidityGenerator';
        } else if (type === "Rewards" || type === "Testudo" || type === "AltCrusaders" || type === "Rebase") {
            contractSelector = name;
        } else {
            contractSelector = 'StandardToken';
        }
        console.log('object: ', JSON.stringify(output.contracts['contract.sol']));
        console.log('bytecode: ', output.contracts['contract.sol'][contractSelector].evm.bytecode.object);
        console.log('abi: ', output.contracts['contract.sol'][contractSelector].abi);
        try {
            const upload_params = {
                Bucket: COMPILED_BUCKET_NAME,
                Key: `${id}.json`,
                Body: JSON.stringify({
                    'id': id,
                    'chain': chain,
                    'bytecode': output.contracts['contract.sol'][contractSelector].evm.bytecode.object,
                    'abi': output.contracts['contract.sol'][contractSelector].abi
                }),
                ContentType: 'application/json'
            };
            updateRequestTableCompiled(id);
            const upload_data = await s3.upload(upload_params).promise();
            const subscribers = await db.fetchContractRequestSubscriptions(id);
            console.log('subscribers: ', JSON.stringify(subscribers));
            const results = subscribers.map(subscriber => {
                const subscriberId = db.parseEntityId(
                    subscriber[db.ContractRequest.Connections.Range]
                );
                console.log('subscriber: ', subscriber);
                try {
                return wsClient.send(subscriberId, {
                    event: "contract_compiled",
                    requestId: id,
                    chain: chain,
                    bytecode: output.contracts['contract.sol'][contractSelector].evm.bytecode.object,
                    abi: output.contracts['contract.sol'][contractSelector].abi
                });
                } catch(err){
                    console.log(err);
                }
            });
    
            await Promise.all(results);
            console.log('upload_data: ', JSON.stringify(upload_data));
            return {
                headers,
                statusCode: 200,
                body: JSON.stringify(upload_data),
            };
        } catch (err) {
            return(err);
        }
    }
}

async function updateRequestTableCompiled (id) {
    var params = {
        TableName:process.env.REQUESTS_TABLE,
        Key:{
            "id": id,
        },
        UpdateExpression: "set compiled = :t",
        ExpressionAttributeValues:{
            ":t": true,
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
}