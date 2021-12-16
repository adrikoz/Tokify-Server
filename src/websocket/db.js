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
        Contracts: {
            Index: 'reverse',
            Key: 'sk',
            Range: 'pk'
        },
        Prefix: 'CONNECTION|',
        Entity: 'CONNECTION'
    },
    Request: {
        Primary: {
            Key: 'pk',
            Range: 'sk'
        },
        Connections: {
            Key: 'pk',
            Range: 'sk'
        },
        Prefix: 'REQUEST|',
        Entity: 'REQUEST'
    },
}

const requestRegex = new RegExp(`^${db.Request.Entity}\|`);
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
    const connectionId = parseEntityId(connection)
    if (db.Connection.Requests){
        const results = await ddb.query({
            TableName: db.Table,
            IndexName: db.Connection.Requests.Index,
            KeyConditionExpression: `${
            db.Connection.Requests.Key
            } = :connectionId and begins_with(${
            db.Connection.Requests.Range
            }, :requestEntity)`,
            ExpressionAttributeValues: {
            ":connectionId": `${db.Connection.Prefix}${
                connectionId
            }`,
            ":requestEntity": db.Request.Prefix
            }
        }).promise();

        return results.Items;
    } else {
        return [];
    }
}

async function fetchRequestSubscriptions(request){
    const requestId = parseEntityId(request)
    const results = await ddb.query({
        TableName: db.Table,
        KeyConditionExpression: `${
          db.Request.Connections.Key
        } = :requestId and begins_with(${
          db.Request.Connections.Range
        }, :connectionEntity)`,
        ExpressionAttributeValues: {
          ":requestId": `${db.Request.Prefix}${requestId}`,
          ":connectionEntity": db.Connection.Prefix
        }
      }).promise();

      return results.Items;
}


const client = {
    ...db,
    parseEntityId,
    fetchConnectionSubscriptions,
    fetchRequestSubscriptions,
    Client: ddb
}

module.exports = client