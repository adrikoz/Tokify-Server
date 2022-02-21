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
                    if (record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S'] === "Liquidity Generator"){
                        const Key = 'liquidity_generator_mw.sol';
                        console.log("point 1");
                        const data = await s3.getObject({ Bucket, Key }).promise();
                        console.log("safemoon: ", JSON.stringify(data));
                        const content = data.Body.toString('ascii').split("\n");
                        content.splice(634, 0, `    uint256 private _tTotal = ${params["totalSupply"]["N"]};`);
                        content.splice(639, 0, `    string private _name = \"${params["tokenName"]["S"]}\";`);
                        content.splice(640, 0, `    string private _symbol = \"${params["tokenSymbol"]["S"]}\";`);
                        content.splice(641, 0, `    uint8 private _decimals = ${params["decimals"]["N"]};`);
                        content.splice(642, 0, `    uint256 public _taxFee = ${params["transactionYield"]["N"]};`);
                        content.splice(645, 0, `    uint256 public _liquidityFee = ${params["transactionLiquidity"]["N"]};`);
                        content.splice(655, 0, `    uint256 public _maxTxAmount = ${params["maxTransactionAmount"]["N"]};`);
                        content.splice(656, 0, `    uint256 private numTokensSellToAddToLiquidity = ${params["minLiquidityTransactionVolume"]["N"]};`);
                        content.splice(658, 0, `    uint256 _protocolFee = ${params["marketingFee"]["N"]}; //USAGE FEE FACTOR (For DEV) - ${params["marketingFee"]["N"]}%`);
                        content.splice(661, 0, `    address payable protocolFeeTaker = payable(${params["marketingWallet"]["S"]}); // Address that gets the protocol fee`);
                        content.splice(682, 0, `       IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(${params["router"]["S"]});`)
                        text = content.join("\n");
                        console.log("text: ", text);
                    } else if (record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S'] === "Rewards") {
                        if (params["transactionYield"]["N"] === "0") {
                            const Key = 'lg_ro_mw.sol';
                            console.log("point 1");
                            const data = await s3.getObject({ Bucket, Key }).promise();
                            console.log("safemoon: ", JSON.stringify(data));
                            const content = data.Body.toString('ascii').split("\n");
                            content.splice(241, 0, `    IBEP20 BUSD = IBEP20(${params["rewardsOtherToken"]["S"]});`);
                            content.splice(242, 0, `    address WBNB = ${params["routerBaseToken"]["S"]};`);
                            content.splice(276, 0, `            : IDEXRouter(${params["router"]["S"]});`);
                            content.splice(396, 0, `contract ${nameNoSpace} is IBEP20, Auth {`);
                            content.splice(400, 0, `    address BUSD = ${params["rewardsOtherToken"]["S"]};`);
                            content.splice(401, 0, `    address public WBNB = ${params["routerBaseToken"]["S"]};`);
                            content.splice(406, 0, `    string constant _name = \"${params["tokenName"]["S"]}\";`);
                            content.splice(407, 0, `    string constant _symbol = \"${params["tokenSymbol"]["S"]}\";`);
                            content.splice(408, 0, `    uint8 constant _decimals = ${params["decimals"]["N"]};`);
                            content.splice(410, 0, `    uint256 private _totalSupply = ${params["totalSupply"]["N"]};`);
                            content.splice(420, 0, `    uint256 liquidityFee = ${params["transactionLiquidity"]["N"]};`);
                            content.splice(421, 0, `    uint256 reflectionFee = ${params["rewardsOther"]["N"]};`);
                            content.splice(422, 0, `    uint256 marketingFee = ${params["marketingFee"]["N"]};`);
                            content.splice(426, 0, `    uint256 buyMultiplier = ${params["buyMultiplier"]["N"]};`);
                            content.splice(427, 0, `    uint256 sellMultiplier = ${params["sellMultiplier"]["N"]};`);
                            content.splice(430, 0, `    address public marketingFeeReceiver = ${params["marketingWallet"]["S"]};`);
                            content.splice(453, 0, `        address _dexRouter = ${params["router"]["S"]};`);
                            text = content.join("\n");
                            console.log("text: ", text);
                        } else {
                            const Key = 'lg_rn_ro_mw.sol';
                            console.log("point 1");
                            const data = await s3.getObject({ Bucket, Key }).promise();
                            console.log("safemoon: ", JSON.stringify(data));
                            const content = data.Body.toString('ascii').split("\n");
                            content.splice(319, 0, `    IBEP20 BUSD = IBEP20(${params["rewardsOtherToken"]["S"]});`);
                            content.splice(320, 0, `    address WBNB = ${params["routerBaseToken"]["S"]};`);
                            content.splice(355, 0, `            : IDEXRouter(${params["router"]["S"]});`);
                            content.splice(515, 0, `contract ${nameNoSpace} is IBEP20, Auth {`);
                            content.splice(519, 0, `    address BUSD = ${params["rewardsOtherToken"]["S"]};`);
                            content.splice(520, 0, `    address public WBNB = ${params["routerBaseToken"]["S"]};`);
                            content.splice(525, 0, `    string constant _name = \"${params["tokenName"]["S"]}\";`);
                            content.splice(526, 0, `    string constant _symbol = \"${params["tokenSymbol"]["S"]}\";`);
                            content.splice(527, 0, `    uint8 constant _decimals = ${params["decimals"]["N"]};`);
                            content.splice(530, 0, `    uint256 private _tTotal = ${params["totalSupply"]["N"]};`);
                            content.splice(545, 0, `    uint256 liquidityFee = ${params["transactionLiquidity"]["N"]};`);
                            content.splice(546, 0, `    uint256 rewardFee = ${params["rewardsOther"]["N"]};`);
                            content.splice(547, 0, `    uint256 rewardNativeFee = ${params["transactionYield"]["N"]};`);
                            content.splice(548, 0, `    uint256 marketingFee = ${params["marketingFee"]["N"]};`);
                            content.splice(558, 0, `    uint256 buyMultiplier = ${params["buyMultiplier"]["N"]};`);
                            content.splice(559, 0, `    uint256 sellMultiplier = ${params["sellMultiplier"]["N"]};`);
                            content.splice(562, 0, `    address public marketingFeeReceiver = ${params["marketingWallet"]["S"]};`);
                            content.splice(589, 0, `        address _dexRouter = ${params["router"]["S"]};`);
                            text = content.join("\n");
                            console.log("text: ", text);
                        }
                    } else if (record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S'] === "Rising Floor") {
                        const Key = 'lg_rBNB_mw_ap.sol';
                        console.log("point 1");
                        const data = await s3.getObject({ Bucket, Key }).promise();
                        console.log("safemoon: ", JSON.stringify(data));
                        const content = data.Body.toString('ascii').split("\n");
                        content.splice(168, 0, `    IBEP20 dividendToken = IBEP20(${params["rewardsOtherToken"]["S"]});`);
                        content.splice(169, 0, `    address public WBNB = ${params["routerBaseToken"]["S"]};`);
                        content.splice(207, 0, `        : IDEXRouter(${params["router"]["S"]});`);
                        content.splice(387, 0, `contract ${nameNoSpace} is IBEP20, Auth {`);
                        content.splice(391, 0, `    address WBNB = ${params["routerBaseToken"]["S"]};`);
                        content.splice(396, 0, `    string constant _name = \"${params["tokenName"]["S"]}\";`);
                        content.splice(397, 0, `    string constant _symbol = \"${params["tokenSymbol"]["S"]}\";`);
                        content.splice(398, 0, `    uint8 constant _decimals = ${params["decimals"]["N"]};`);
                        content.splice(400, 0, `    uint256 private _totalSupply = ${params["totalSupply"]["N"]};`);
                        content.splice(411, 0, `    uint256 liquidityFee = ${params["transactionLiquidity"]["N"]};`);
                        content.splice(413, 0, `    uint256 rewardsFee = ${params["rewardsOther"]["N"]};`);
                        content.splice(415, 0, `    uint256 backingFee = ${params["backingFee"]["N"]};`);
                        content.splice(417, 0, `    uint256 marketingFee = ${params["marketingFee"]["N"]};`);
                        text = content.join("\n");
                        console.log("text: ", text);
                    } else if (record['dynamodb']['NewImage']['parameters']['M']['selectedFunctions']['S'] === "AltCrusaders") {
                        const Key = 'altcrusaders.sol';
                        console.log("point 1");
                        const data = await s3.getObject({ Bucket, Key }).promise();
                        console.log("safemoon: ", JSON.stringify(data));
                        const content = data.Body.toString('ascii').split("\n");
                        content.splice(145, 0, `contract ${nameNoSpace} is IBEP20, Auth {`);
                        content.splice(149, 0, `    address public WBNB = ${params["routerBaseToken"]["S"]};`);
                        content.splice(154, 0, `    string constant _name = \"${params["tokenName"]["S"]}\";`);
                        content.splice(155, 0, `    string constant _symbol = \"${params["tokenSymbol"]["S"]}\";`);
                        content.splice(156, 0, `    uint8 constant _decimals = ${params["decimals"]["N"]};`);
                        content.splice(158, 0, `    uint256 private _totalSupply = ${params["totalSupply"]["N"]};`);
                        content.splice(171, 0, `    uint256 buyLiquidityFee = ${params["buyLiquidityFee"]["N"]};`);
                        content.splice(172, 0, `    uint256 buyMarketingFee = ${params["buyMarketingFee"]["N"]};`);
                        content.splice(173, 0, `    uint256 buyDeveloperFee = ${params["buyDeveloperFee"]["N"]};`);
                        content.splice(174, 0, `    uint256 buyTeamFee = ${params["buyTeamFee"]["N"]};`);
                        content.splice(177, 0, `    uint256 sellLiquidityFee = ${params["sellLiquidityFee"]["N"]};`);
                        content.splice(178, 0, `    uint256 sellMarketingFee = ${params["sellMarketingFee"]["N"]};`);
                        content.splice(179, 0, `    uint256 sellDeveloperFee = ${params["sellDeveloperFee"]["N"]};`);
                        content.splice(180, 0, `    uint256 sellTeamFee = ${params["sellTeamFee"]["N"]};`);
                        text = content.join("\n");
                        console.log("text: ", text);
                    } else {
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