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
            marketingWallet: requestJSON.marketing_wallet,
        };
        console.log("parameters 1")

        if (requestJSON.selected_function === "Liquidity Generator") {
            let liqGenParametersMap = {
                developerWallet: requestJSON.developer_wallet,
                teamWallet: requestJSON.team_wallet,
                router: requestJSON.router,
                routerBaseToken: requestJSON.router_base_token,
                buyMarketingFee: parseInt(parseFloat(requestJSON.buy_marketing_fee) * 100, 10),
                sellMarketingFee: parseInt(parseFloat(requestJSON.sell_marketing_fee) * 100, 10),
                buyDeveloperFee: parseInt(parseFloat(requestJSON.buy_developer_fee) * 100, 10),
                sellDeveloperFee: parseInt(parseFloat(requestJSON.sell_developer_fee) * 100, 10),
                buyTeamFee: parseInt(parseFloat(requestJSON.buy_team_fee) * 100, 10),
                sellTeamFee: parseInt(parseFloat(requestJSON.sell_team_fee) * 100, 10),
                buyLiquidityFee: parseInt(parseFloat(requestJSON.buy_liquidity_fee) * 100, 10),
                sellLiquidityFee: parseInt(parseFloat(requestJSON.sell_liquidity_fee) * 100, 10),
            };
            parametersMap = [parametersMap, liqGenParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        }
        
        /*if(requestJSON.selected_function === "Liquidity Generator") {
            let liqGenParametersMap = {
                marketingFee: parseInt(requestJSON.marketing_fee, 10),
                router: requestJSON.router,
                transactionYield: parseInt(requestJSON.transaction_yield, 10),
                transactionLiquidity: parseInt(requestJSON.transaction_liquidity, 10),
                maxTransactionAmount: parseInt(requestJSON.max_transaction_amount, 10) * 10 ** decimals,
                minLiquidityTransactionVolume: parseInt(requestJSON.min_liquidity_transaction_volume) * 10 ** decimals
            };
            parametersMap = [parametersMap, liqGenParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        }*/

        if(requestJSON.selected_function === "Standard") {
            let standardParametersMap = {
                marketingFee: parseInt(requestJSON.marketing_fee, 10),
            };
            parametersMap = [parametersMap, standardParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        } 

        if(requestJSON.selected_function === "Rewards") {
            let rewardsParametersMap = {
                marketingFee: parseInt(parseFloat(requestJSON.marketing_fee) * 100, 10),
                router: requestJSON.router,
                routerBaseToken: requestJSON.router_base_token,
                transactionYield: parseInt(parseFloat(requestJSON.transaction_yield) * 100, 10),
                transactionLiquidity: parseInt(parseFloat(requestJSON.transaction_liquidity) * 100, 10),
                rewardsOther: parseInt(parseFloat(requestJSON.rewards_other) * 100, 10),
                rewardsOtherToken: requestJSON.rewards_other_token,
                sellMultiplier: parseInt(parseFloat(requestJSON.sell_multiplier) * 10000, 10),
                buyMultiplier: parseInt(parseFloat(requestJSON.buy_multiplier) * 10000, 10),
            };
                parametersMap = [parametersMap, rewardsParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        } 

        if(requestJSON.selected_function === "Testudo") {
            let risingFloorParametersMap = {
                marketingFee: parseInt(parseFloat(requestJSON.marketing_fee) * 100, 10),
                router: requestJSON.router,
                routerBaseToken: requestJSON.router_base_token,
                transactionLiquidity: parseInt(parseFloat(requestJSON.transaction_liquidity) * 100, 10),
                rewardsOther: parseInt(parseFloat(requestJSON.rewards_other) * 100, 10),
                rewardsOtherToken: requestJSON.rewards_other_token,
                backingFee: parseInt(parseFloat(requestJSON.backing_fee) * 100, 10),
            };
                parametersMap = [parametersMap, risingFloorParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        }

        if(requestJSON.selected_function === "Rising Floor") {
            let risingFloorParametersMap = {
                marketingFee: parseInt(parseFloat(requestJSON.marketing_fee) * 100, 10),
                router: requestJSON.router,
                routerBaseToken: requestJSON.router_base_token,
                transactionLiquidity: parseInt(parseFloat(requestJSON.transaction_liquidity) * 100, 10),
                backingFee: parseInt(parseFloat(requestJSON.backing_fee) * 100, 10),
            };
                parametersMap = [parametersMap, risingFloorParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        }

        if(requestJSON.selected_function === "Rebase") {
            let liqGenParametersMap = {
                router: requestJSON.router,
                marketingFee: parseInt(parseFloat(requestJSON.marketing_fee) * 100, 10),
                transactionLiquidity: parseInt(parseFloat(requestJSON.transaction_liquidity) * 100, 10),
                riskFreeValue: parseInt(parseFloat(requestJSON.risk_free_value) * 100, 10),
                sellFee: parseInt(parseFloat(requestJSON.sell_fee) * 100, 10),
            };
            parametersMap = [parametersMap, liqGenParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        } 

        if(requestJSON.selected_function === "Lottery") {
            let liqGenParametersMap = {
                router: requestJSON.router,
                routerBaseToken: requestJSON.router_base_token,
                marketingFee: parseInt(parseFloat(requestJSON.marketing_fee) * 100, 10),
                transactionLiquidity: parseInt(parseFloat(requestJSON.transaction_liquidity) * 100, 10),
                transactionYield: parseInt(parseFloat(requestJSON.transaction_yield) * 100, 10),
                burnFee: parseInt(parseFloat(requestJSON.burn_fee) * 100, 10),
                lotteryFee: parseInt(parseFloat(requestJSON.lottery_fee) * 100, 10),
            };
            parametersMap = [parametersMap, liqGenParametersMap].reduce(function (r, o) {
                Object.keys(o).forEach(function (k) { r[k] = o[k]; });
                return r;
            }, {});
        } 

        console.log("parameters 2:", parametersMap);
        
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