### PING

Request:

```json
{
  "method": "PING",
  "params": {
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

Response:

```json
{
  "result": {
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

### STORE

Request:

```json
{
  "method": "STORE",
  "params": {
    "item": {
      "key": "<key>",
      "value": "<value>",
      "timestamp": 1450715749709,
      "publisher": "<node_id>"
    },
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

Response:

```json
{
  "result": {
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

### FIND_NODE

Request:

```json
{
  "method": "FIND_NODE",
  "params": {
    "key": "<key>",
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

Response:

```json
{
  "result": {
    "nodes": [
      {
        "address": "<net_addr>",
        "port": 1234,
        "nodeID": "<node_id>"
      },
      {
        "address": "<net_addr>",
        "port": 1234,
        "nodeID": "<node_id>"
      },
      {
        "address": "<net_addr>",
        "port": 1234,
        "nodeID": "<node_id>"
      }
    ],
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

### FIND_VALUE

Request:

```json
{
  "method": "FIND_VALUE",
  "params": {
    "key": "<key>",
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

Response:

```json
{
  "result": {
    "item": {
      "key": "<key>",
      "value": "<value>",
      "timestamp": 1450715749709,
      "publisher": "<node_id>"
    },
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "id": "<rpc_id>"
}
```

### ERROR

```json
{
  "result": {
    "contact": {
      "address": "<net_addr>",
      "port": 1234,
      "nodeID": "<node_id>"
    }
  },
  "error": {
    "code": -32603,
    "message": "<error_message>"
  },
  "id": "<rpc_id>"
}
```
