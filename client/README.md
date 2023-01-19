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


### Get all assets Org1

```bash
http POST "http://localhost:3003/evaluate" fcn=GetAllAssets 
```
### Get all assets Org2

```bash
http POST "http://localhost:3004/evaluate" fcn=GetAllAssets 
```


### Create asset Org1

```bash
http POST "http://localhost:3003/submit" fcn=CreateAsset "args[]=AssetKey11" "args[]=Blue" "args[]=10" "args[]=4"

http POST "http://localhost:3003/evaluate" fcn=ReadAsset "args[]=AssetKey11"
```

### Transfer asset from Org1 to Org2
```bash
http POST "http://localhost:3003/submit" fcn=TransferAsset "args[]=AssetKey11" "args[]=Org2MSP:x509::/OU=admin/CN=admin::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca"
```


### Read asset to verify owner

```bash
http POST "http://localhost:3003/evaluate" fcn=ReadAsset "args[]=AssetKey11"

```
### Org2 updates the asset

```bash
http POST "http://localhost:3004/submit" fcn=UpdateAsset "args[]=AssetKey11" "args[]=Red" "args[]=10" "args[]=4"
http POST "http://localhost:3004/evaluate" fcn=ReadAsset "args[]=AssetKey11"
```

### Transfer asset back to Org1


```bash
http POST "http://localhost:3004/submit" fcn=TransferAsset "args[]=AssetKey11" "args[]=Org1MSP:x509::/OU=admin/CN=admin::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca"

```
### Read asset to verify owner again

```bash
http POST "http://localhost:3003/evaluate" fcn=ReadAsset "args[]=AssetKey11"

```