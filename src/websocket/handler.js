const db = require("./db");
const ws = require("./websocket-client");

const wsClient = new ws.Client();

const success = {
  statusCode: 200
};

async function connection_manager(event, context) {
  // we do this so first connect EVER sets up some needed config state in db
  // this goes away after CloudFormation support is added for web sockets
  await wsClient._setupClient(event);

  if (event.requestContext.eventType === "CONNECT") {
    // sub general request
    await subscribe_request(
      {
        ...event,
        body: JSON.stringify({
          action: "subscribe",
          requestId: ""
        })
      },
      context
    );

    return success;
  } else if (event.requestContext.eventType === "DISCONNECT") {
    // unsub all requests connection was in
    const subscriptions = await db.fetchConnectionSubscriptions(event);
    const unsubscribes = subscriptions.map(async subscription =>
      // just simulate / reuse the same as if they issued the request via the protocol
      unsubscribe_request(
        {
          ...event,
          body: JSON.stringify({
            action: "unsubscribe",
            requestId: db.parseEntityId(subscription[db.Request.Primary.Key])
          })
        },
        context
      )
    );

    await Promise.all(unsubscribes);
    return success;
  }
}

async function default_websocket(event) {
  await wsClient.send(event, {
    event: "error",
    message: "invalid action type"
  });

  return success;
}

async function request_manager(event, context) {
    const action = JSON.parse(event.body).action;
    switch (action) {
      case "subscribe_request":
        await subscribe_request(event, context);
        break;
      case "unsubscribe_request":
        await unsubscribe_request(event, context);
        break;
      default:
        break;
    }
  
    return success;
  }
  
  async function subscribe_request(event, context) {
    const requestId = JSON.parse(event.body).requestId;
    await db.Client.put({
      TableName: db.Table,
      Item: {
        [db.Request.Connections.Key]: `${db.Request.Prefix}${requestId}`,
        [db.Request.Connections.Range]: `${db.Connection.Prefix}${
          db.parseEntityId(event)
        }`
      }
    }).promise();
  
    // Instead of broadcasting here we listen to the dynamodb stream
    // just a fun example of flexible usage
    // you could imagine bots or other sub systems broadcasting via a write the db
    // and then streams does the rest
    return success;
  }
  
  async function unsubscribe_request(event, context) {
    const requestId = JSON.parse(event.body).requestId;
    const item = await db.Client.delete({
      TableName: db.Table,
      Key: {
        [db.Request.Connections.Key]: `${db.Request.Prefix}${requestId}`,
        [db.Request.Connections.Range]: `${db.Connection.Prefix}${
          db.parseEntityId(event)
        }`
      }
    }).promise();
    return success;
  }

module.exports = {
    connection_manager,
    default_websocket,
    subscribe_request,
    unsubscribe_request,
    request_manager
  };