"use strict";

const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const axios = require("axios");
const Web3 = require("web3");
const web3_bsc = new Web3("https://bsc-dataseed1.binance.org:443");

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
};

module.exports.handler = (event) => {
    const requestParams = event.queryStringParameters;
    const { address, chainId, newTokenPerOld } = requestParams;
    console.log(address);
    console.log(chainId);
    const url = `https://api.covalenthq.com/v1/${chainId}/tokens/${address}/token_holders/?key=${process.env.COVALENT_KEY}&page-size=999999999`;
    console.log(url);
    const returnObject = axios
        .get(url, {
            headers: {
                Accept: "application/json",
            },
        })
        .then( async (res) => {
            console.log(res);
            const data = res["data"]["data"];
            const time = data["updated_at"];
            const items = data["items"];
            const decimals = items[0]["contract_decimals"];
            const blockHeight = items[0]["block_height"];
            const csv = await getUploadFile(items, address, newTokenPerOld);
            const fileName = `${address}_${blockHeight}_${chainId}.csv`;
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
            console.log('url: ', url);
            const toSend = {
                fileUrl: url,
                time: time,
                blockHeight: blockHeight,
                url: fileName,
                decimals: decimals
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
    return returnObject;
};

const convertToCSV = (holders) => {
    var csv = holders
      .map(function (d) {
        return d.join();
      })
        .join("\n");
    return csv;
};

const getUploadFile = async (items, tokenAddress, newTokenPerOld) => {
    let minABI = [
        // balanceOf
        {
            "constant": true,
            "inputs": [{ "name": "_owner", "type": "address" }],
            "name": "balanceOf",
            "outputs": [{ "name": "balance", "type": "uint256" }],
            "type": "function"
        }];
    let contract = new web3_bsc.eth.Contract(minABI, tokenAddress);
    var holders = [];
    const blockHeight = items[0]["block_height"];
    for (const value of items) {
        await contract.methods
          .balanceOf(value["address"])
          .call(null, blockHeight, (error, balance) => {
            console.log("balance: ", web3_bsc.utils.fromWei(balance, "wei"));
            const holder = [value["address"], BigInt(web3_bsc.utils.fromWei(balance, "wei")) * BigInt(newTokenPerOld)];
            holders.push(holder);
            // Do whatever else you want with the code.
          });
        
    }
    //console.log("holders: " + JSON.stringify(holders));
    const csv = convertToCSV(holders)
    console.log(csv);
    return csv;
};
