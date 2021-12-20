const AWS = require("aws-sdk");
const db = require("./db")

class Client {
    constructor(config){
        this.client;
        if(config){
            this._setupClient(config)
        }
    }

    // allow just passing a single event to setup the client for ease of use
    async _setupClient(config){
        // fetch config from db if none provided and we do not have a client
        console.log('type of config: ', typeof config);
        if(typeof config !== 'object' && !this.client){
            console.log('option 1');
            try {
            console.log('table name: ', db.Table);
            console.log('Key: ', JSON.stringify(
                {
                    [db.Primary.Key]: 'APPLICATION',
                    [db.Primary.Range]: 'WS_CONFIG'
                }
            ))
            const item = await db.Client.get({
                TableName: db.Table,
                Key: {
                    [db.Primary.Key]: 'APPLICATION',
                    [db.Primary.Range]: 'WS_CONFIG'
                }
            }).promise();
            console.log('item retrieved');
            console.log(JSON.stringify(item));
            config = item.Item;
            config.fromDb = true;
            } catch (err) {
                console.log(err);
            }
        }

        if(!this.client){
            console.log('option 2');
            
            if(config.requestContext.apiId){
                config.requestContext.domainName  = `${config.requestContext.apiId}.execute-api.${process.env.API_REGION}.amazonaws.com`
            }
          
            this.client = new AWS.ApiGatewayManagementApi({
                apiVersion: "2018-11-29",
                endpoint: `https://${config.requestContext.domainName}/${config.requestContext.stage}`
            });

            console.log('2a');

            // temporarily we update dynamodb with most recent info
            // after CF support this can go away, we just do this so a single deployment makes this work
            if(config.fromDb !== true){
                await db.Client.put({
                    TableName: db.Table,
                    Item: {
                        [db.Primary.Key]: 'APPLICATION',
                        [db.Primary.Range]: 'WS_CONFIG',
                        requestContext: {
                            domainName: config.requestContext.domainName,
                            stage: config.requestContext.stage
                        },
                    }
                }).promise();
            }
            console.log('2b');
        }
    }

    async send(connection, payload){
        console.log('this is posting');
        // Cheat and allow event to be passed in
        // this also lets us default to setupClient too
        await this._setupClient(connection)

        console.log('client set up');

        let ConnectionId = connection;
        if(typeof connection === 'object'){
            ConnectionId = connection.requestContext.connectionId;
        }

        console.log(connection, payload)
        await this.client.postToConnection({
            ConnectionId,
            Data: JSON.stringify(payload)
        }).promise().catch(async err => {
            console.log(JSON.stringify(err))
          
            if (err.statusCode === 410) {
                // unsub all requests connection was in
                const subscriptions = await db.fetchConnectionSubscriptions(ConnectionId);

                console.log(`[wsClient][send][postToConnection] Found stale connection, deleting ${ConnectionId}:`);
                console.log('[wsClient][send][postToConnection] Unsubscribe from requests:');
                console.log(JSON.stringify(subscriptions, null, 2));

                const unsubscribes = subscriptions.map(async subscription =>
                    db.Client.delete({
                        TableName: db.Table,
                        Key: {
                            [db.ContractRequest.Connections.Key]: `${db.ContractRequest.Prefix}${db.parseEntityId(subscription[db.ContractRequest.Primary.Key])}`,
                            [db.ContractRequest.Connections.Range]: `${db.Connection.Prefix}${ConnectionId}`
                        }
                    }).promise()
                );

                await Promise.all(unsubscribes);
            }
        });

        return true;
    }
}

module.exports = {
    Client
}