# API

This API exposes via HTTP the operations that can be performed on the chaincode assets.

## Install libraries

```bash
npm install
```

## Launch the server for Org1

Launch the server for the Org1

```bash
npm run server:org1:dev
```

## Launch the server for Org2

Launch the server for the Org2

```bash
npm run server:org2:dev
```

## Operations

There are two APIs:

Org1: http://localhost:3003
Org2: http://localhost:3004

### Register a user

```bash
http POST "http://localhost:3004/signup" username="user1" password="user1pw"
```

### Login with a user

This operation must be done every time the program is restarted

```bash
http POST "http://localhost:3004/login" username="user1" password="user1pw"
```
<!-- TODO: Interact with assets API -->