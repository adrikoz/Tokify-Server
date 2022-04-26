"use strict";

const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const axios = require("axios");

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
};

module.exports.handler = async (event) => {
    const requestParams = event.queryStringParameters;
    const { address, chainId } = requestParams;
    const url = `https://api.covalenthq.com/v1/${chainId}/tokens/${address}/token_holders/?key=${process.env.COVALENT_KEY}`;
    axios
        .get(url, {
            headers: {
                Accept: "application/json",
            },
        })
        .then( async (res) => {
            console.log(`statusCode: ${res.status}`);
            console.log(res);
            const data = res["data"]["data"];
            const time = data["updated_at"];
            const items = data["items"];
            const blockHeight = items[0]["block_height"];
            const decimals = items[0]["contract_decimals"];
            var holders = [];
            items.forEach(function (value) {
                console.log(value);
                const balance = value["balance"] / (10 ** decimals);
                const holder = [value["address"],balance];
                holders.push(holder);
            });
            console.log("holders: " + JSON.stringify(holders));
            const csv = convertToCSV(holders)
            console.log(csv);
            const fileName = `${address}_${blockHeight}_${chainId}.csv`
            const upload_params = {
                Bucket: process.env.SNAPSHOT_BUCKET_NAME,
                Key: fileName,
                Body: csv,
            };
            const upload_data = await s3.upload(upload_params).promise();
            const url = s3.getSignedUrl("getObject", {
                Bucket: process.env.SNAPSHOT_BUCKET_NAME,
                Key: fileName,
                Expires: 60,
            });
            console.log('upload data:', JSON.stringify(upload_data));
            const toSend = {
                fileUrl: url,
                time: time,
                blockHeight: blockHeight,
                url: fileName
            };
            return {
              headers,
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*", // changed this
              },
              body: JSON.stringify(toSend),
            };
        })
        .catch((error) => {
            console.error(error);
        });
};

const convertToCSV = (holders) => {
    var csv = holders
      .map(function (d) {
        return d.join();
      })
        .join("\n");
    return csv;
};
