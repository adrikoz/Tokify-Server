'use strict'
const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();

module.exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
    };

    console.log('event: ', JSON.stringify(event));

    const requestBody = JSON.parse(event.body);

    console.log('body: ', JSON.stringify(requestBody));
    const txHash = requestBody.txHash;
    const id = requestBody.id;

    console.log(id);
    console.log(txHash);

    var params = {
        TableName:process.env.REQUESTS_TABLE,
        Key:{
            "id": id,
        },
        UpdateExpression: "set txHash = :hash, txTime = :time",
        ExpressionAttributeValues:{
            ":hash": txHash,
            ":time": new Date().toISOString()
        },
        ReturnValues:"UPDATED_NEW"
    };


    var body = '';

    await dynamo.update(params, function(err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
            body = err.message;
        } else {
            console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
            body = 'success';
        }
    }).promise();

    return {
        headers,
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*' // changed this
        },
        body: body,
    };
}