const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

const db = {
    Table: process.env.CONNECTIONS_TABLE,
    Primary: {
        Key: 'pk',
        Range: 'sk'
    },
    Connection: {
        Primary: {
            Key: 'pk',
            Range: 'sk'
        },
        ContractRequests: {
            Index: 'reverse',
            Key: 'sk',
            Range: 'pk'
        },
        Prefix: 'CONNECTION|',
        Entity: 'CONNECTION'
    },
    ContractRequest: {
        Primary: {
            Key: 'pk',
            Range: 'sk'
        },
        Connections: {
            Key: 'pk',
            Range: 'sk'
        },
        Prefix: 'CONTRACTREQUEST|',
        Entity: 'CONTRACTREQUEST'
    },
}

const requestRegex = new RegExp(`^${db.ContractRequest.Entity}\|`);
const connectionRegex = new RegExp(`^${db.Connection.Entity}\|`);

function parseEntityId(target){
    console.log('ENTITY ID A ', target)

    if(typeof target === 'object'){
        // use from raw event, only needed for connectionId at the moment
        target = target.requestContext.connectionId;
    } else {
        // strip prefix if set so we always get raw id
        target = target
                .replace(requestRegex, '')
                .replace(connectionRegex, '');
    }

    return target.replace('|', ''); // why?!
}

async function fetchConnectionSubscriptions(connection){
    console.log('fetching subscriptions: ', JSON.stringify(connection));
    const connectionId = parseEntityId(connection)
    console.log('connectionId: ', connectionId);
    if (db.Connection.ContractRequests){
        const results = await ddb.query({
            TableName: db.Table,
            IndexName: db.Connection.ContractRequests.Index,
            KeyConditionExpression: `${
            db.Connection.ContractRequests.Key
            } = :connectionId and begins_with(${
            db.Connection.ContractRequests.Range
            }, :requestEntity)`,
            ExpressionAttributeValues: {
            ":connectionId": `${db.Connection.Prefix}${
                connectionId
            }`,
            ":requestEntity": db.ContractRequest.Prefix
            }
        }).promise();
        console.log('items: ', JSON.stringify(results.Items));
        return results.Items;
    } else {
        console.log('no items found');
        return [];
    }
}

async function fetchContractRequestSubscriptions(request){
    console.log('fetching subscriptions: ', JSON.stringify(request));
    const requestId = parseEntityId(request);
    console.log('requestId: ', requestId);
    const results = await ddb.query({
        TableName: db.Table,
        KeyConditionExpression: `${
          db.ContractRequest.Connections.Key
        } = :requestId and begins_with(${
          db.ContractRequest.Connections.Range
        }, :connectionEntity)`,
        ExpressionAttributeValues: {
          ":requestId": `${db.ContractRequest.Prefix}${requestId}`,
          ":connectionEntity": db.Connection.Prefix
        }
    }).promise();

    return results.Items;
}


const client = {
    ...db,
    parseEntityId,
    fetchConnectionSubscriptions,
    fetchContractRequestSubscriptions,
    Client: ddb
}

module.exports = client