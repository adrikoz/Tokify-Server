'use strict'
const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();

const db = require("src/websocket/db");

const ws = require("src/websocket/websocket-client");
const wsClient = new ws.Client();

module.exports.handler = async (event, context) => {
    let body;
    let statusCode = 200;
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
    };

    try {
        console.log("request started");
        console.log("event: ", JSON.stringify(event));
        let body = JSON.parse(event.body);
        console.log("body: ", JSON.stringify(body));
        let requestJSON = body.data;
        console.log("JSON: ", JSON.stringify(requestJSON));
        let id = 'id' in requestJSON
            ? requestJSON.id
            : context.awsRequestId;

        console.log('id: ', id);
        
        try {
            await db.Client.put({
            TableName: db.Table,
            Item: {
                [db.ContractRequest.Connections.Key]: `${db.ContractRequest.Prefix}${id}`,
                [db.ContractRequest.Connections.Range]: `${db.Connection.Prefix}${
                db.parseEntityId(event)
                }`,
                ttl: parseInt((Date.now() / 1000) + 600)
            }
            }).promise();
        } catch(err) {
            console.log(err);
        }

        var decimals = parseInt(requestJSON.decimals, 10)
        var totalSupply = parseInt(requestJSON.total_supply, 10) * 10 ** decimals;

        let parametersMap = {
          tokenName: requestJSON.token_name,
          tokenSymbol: requestJSON.token_symbol,
          decimals: decimals,
          totalSupply: totalSupply,
          selectedFunctions: requestJSON.selected_function,
        };
        console.log("parameters 1")
        
        if(requestJSON.selected_function === "Liquidity Generator") {
          let liqGenParametersMap = {
            router: requestJSON.router,
            transactionYield: parseInt(requestJSON.transaction_yield, 10),
            transactionLiquidity: parseInt(requestJSON.transaction_liquidity, 10),
            maxTransactionAmount: parseInt(requestJSON.max_transaction_amount, 10) * 10 ** decimals,
            marketingWallet: requestJSON.marketing_wallet,
            marketingFee: parseInt(requestJSON.marketing_fee, 10),
            minLiquidityTransactionVolume: parseInt(requestJSON.min_liquidity_transaction_volume) * 10 ** decimals
          };
          parametersMap = [parametersMap, liqGenParametersMap].reduce(function (r, o) {
            Object.keys(o).forEach(function (k) { r[k] = o[k]; });
            return r;
          }, {});
        } 

        console.log("parameters 2")
        
        await dynamo.put({
            TableName: process.env.REQUESTS_TABLE,
            Item: {
            id: id,
            userAddress: requestJSON.userAddress,
            chain: requestJSON.select_chain,
            functions: requestJSON.function,
            parameters: parametersMap,
            timestamp: new Date().toISOString(),
            generated: false,
            compiled: false,
            deployed: false,
            txHash: '',
            paymentType: requestJSON.payment_type,
            paymentTx: requestJSON.payment_tx
            }
        }).promise();
        try {
        const subscribers = await db.fetchContractRequestSubscriptions(id);
        console.log('subscribers: ', JSON.stringify(subscribers));
        const results = subscribers.map(subscriber => {
            const subscriberId = db.parseEntityId(
                subscriber[db.ContractRequest.Connections.Range]
            );
            console.log('subscriber: ', subscriber);
            try {
            return wsClient.send(subscriberId, {
                event: "request_sent",
                requestId: id,
            });
            } catch(err){
                console.log(err);
            }
        });

        await Promise.all(results);

        } catch (err) {
            console.log(err);
        }
        body = 'request loaded: ' + id;
        console.log('dynamo');
    } catch (err) {
        statusCode = 400;
        body = err.message + 'error in coad';
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
        headers
    };
};