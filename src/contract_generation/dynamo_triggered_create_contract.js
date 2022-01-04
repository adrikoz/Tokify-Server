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
                        console.log(TEMPLATE_BUCKET_NAME);
                        const Bucket = TEMPLATE_BUCKET_NAME;
                        var text = "";
                        var solidityVersion = "latest";
                        if (record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S'] === "Liquidity Generator"){
                            solidityVersion = "v0.8.0+commit.c7dfd78e";
                            const Key = 'liquidity_generator_mw.sol';
                            console.log("point 1");
                            const data = await s3.getObject({ Bucket, Key }).promise();
                            console.log("safemoon: ", JSON.stringify(data));
                            const content = data.Body.toString('ascii').split("\n");
                            content.splice(634, 0, `    uint256 private _tTotal = ${params["totalSupply"]["N"]};`);
                            content.splice(639, 0, `    string private _name = \"${params["tokenName"]["S"]}\";`);
                            content.splice(640, 0, `    string private _symbol = \"${params["tokenSymbol"]["S"]}\";`);
                            content.splice(641, 0, `    uint8 private _decimals = ${params["decimals"]["N"]};`);
                            content.splice(643, 0, `    uint256 public _taxFee = ${params["transactionYield"]["N"]};`);
                            content.splice(646, 0, `    uint256 public _liquidityFee = ${params["transactionLiquidity"]["N"]};`);
                            content.splice(655, 0, `    uint256 public _maxTxAmount = ${params["maxTransactionAmount"]["N"]};`);
                            content.splice(656, 0, `    uint256 private numTokensSellToAddToLiquidity = ${params["minLiquidityTransactionVolume"]["N"]};`);
                            content.splice(658, 0, `    uint256 _protocolFee = ${params["marketingFee"]["N"]}; //USAGE FEE FACTOR (For DEV) - ${params["marketingFee"]["N"]}%`);
                            content.splice(661, 0, `    address payable protocolFeeTaker = payable(${params["marketingWallet"]["S"]}); // Address that gets the protocol fee`);
                            content.splice(682, 0, `       IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(${params["router"]["S"]});`)
                            text = content.join("\n");
                            console.log("text: ", text);
                        } else {
                            solidityVersion = 'v0.8.0+commit.c7dfd78e';
                            const Key = 'standard_mw.sol';
                            console.log("point 1");
                            const data = await s3.getObject({ Bucket, Key }).promise();
                            console.log("standard: ", JSON.stringify(data));
                            const content = data.Body.toString('ascii').split("\n");
                            content.splice(568, 0, `    uint256 initialSupply_ = ${params["totalSupply"]["N"]};`);
                            content.splice(569, 0, `    string name_ = \"${params["tokenName"]["S"]}\";`);
                            content.splice(570, 0, `    string symbol_ = \"${params["tokenSymbol"]["S"]}\";`);
                            content.splice(571, 0, `    uint8 decimals_ = ${params["decimals"]["N"]};`);
                            content.splice(573, 0, `    uint256 _protocolFee = ${params["marketingFee"]["N"]}; //USAGE FEE FACTOR (For DEV) - ${params["marketingFee"]["N"]}%`);
                            content.splice(577, 0, `    address payable protocolFeeTaker = payable(${params["marketingWallet"]["S"]}); // Address that gets the protocol fee`);
                            text = content.join("\n");
                            console.log("text: ", text);
                        }
                        
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
                                'solidityVersion': solidityVersion,
                                'type': record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S']
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