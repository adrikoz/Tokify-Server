'use strict';

const AWS = require('aws-sdk')
var docClient = new AWS.DynamoDB.DocumentClient();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};
module.exports.handler = async (event) => {
    console.log("started");
    console.log('event: ', JSON.stringify(event));
    const requestParams = event.queryStringParameters;
    const {userAddress} = requestParams;

    console.log('user address: '. userAddress);

    var params = {
        TableName: process.env.REQUESTS_TABLE,
        ProjectionExpression: "#user, id, txHash, chain, #p.tokenName, #p.tokenSymbol",
        FilterExpression: "#user = :address",
        ExpressionAttributeNames: {
            "#user": "userAddress",
            "#p": 'parameters'
        },
        ExpressionAttributeValues: {
             ":address": userAddress,
        }
    };

    var results = [];
    
    while (true) {
        console.log("Scanning Requests table.");
        const data = await docClient.scan(params).promise();

        // print all the movies
        console.log("Scan succeeded.");
        data.Items.forEach(function(contract) {
            console.log(JSON.stringify(contract));
            console.log(
                contract.id + ": ",
                contract.txHash, "- chain:", contract.chain);
            results.push(contract);
            console.log(results);
        });
        console.log('resutltls: ', results);

        // continue scanning if we have more movies, because
        // scan can retrieve a maximum of 1MB of data
        if (typeof data.LastEvaluatedKey != "undefined") {
            console.log("Scanning for more...");
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        } else {
            console.log('resutls: ', results);
            break;
        }
    }

    //await Promise.all(results);

    return {
        headers,
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*' // changed this
        },
        body: JSON.stringify(results),
    };
}