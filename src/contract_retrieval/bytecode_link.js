'use strict';

const AWS = require('aws-sdk')
const s3 = new AWS.S3()

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};
module.exports.handler = async (event) => {
    console.log("started");
    const Bucket = process.env.COMPILED_CONTRACT_BUCKET_NAME;
    console.log('event: ', JSON.stringify(event));
    const requestParams = event.queryStringParameters;
    const {id} = requestParams;
    const Key = `${id}.json`;
    const data = await s3.getObject({ Bucket, Key }).promise();
    const compiledContract = JSON.parse(data.Body.toString('utf-8'));
    console.log('json: ', JSON.stringify(compiledContract));
    const toSend = {
        requestId: id,
        chain: compiledContract.chain,
        bytecode: compiledContract.bytecode,
        abi: compiledContract.abi
    };
    return {
        headers,
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*' // changed this
        },
        body: JSON.stringify(toSend),
    };
}