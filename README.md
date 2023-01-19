# Hyperledger Meetup 2023 on Hyperledger Fabric

## Sponsor

|                                                                         |                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![kfs logo](https://avatars.githubusercontent.com/u/74511895?s=200&v=4) | If you want to design and deploy a secure Blockchain network based on the latest version of Hyperledger Fabric, feel free to contact dviejo@kungfusoftware.es or visit [https://kfs.es/blockchain](https://kfs.es/blockchain) |


## Getting started

# Tutorial

Resources:

- [Hyperledger Fabric build ARM](https://www.polarsparc.com/xhtml/Hyperledger-ARM-Build.html)

## Create Kubernetes Cluster

To start deploying our red fabric we have to have a Kubernetes cluster. For this we will use KinD.

Ensure you have these ports available before creating the cluster:

- 80
- 443

If these ports are not available this tutorial will not work.

```bash
cat << EOF > resources/kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30949
    hostPort: 80
  - containerPort: 30950
    hostPort: 443
EOF

kind create cluster --config=./resources/kind-config.yaml

```

## Install Kubernetes operator

In this step we are going to install the kubernetes operator for Fabric, this will install:

- CRD (Custom Resource Definitions) to deploy Fabric Peers, Orderers and Certification Authorities
- Deploy the program to deploy the nodes in Kubernetes

To install helm: [https://helm.sh/docs/intro/install/](https://helm.sh/docs/intro/install/)

```bash
helm repo add kfs https://kfsoftware.github.io/hlf-helm-charts --force-update

helm install hlf-operator --version=1.8.2 kfs/hlf-operator
```

### Install the Kubectl plugin

To install the kubectl plugin, you must first install Krew:
[https://krew.sigs.k8s.io/docs/user-guide/setup/install/](https://krew.sigs.k8s.io/docs/user-guide/setup/install/)

Afterwards, the plugin can be installed with the following command:

```bash
kubectl krew install hlf
```

### Install Istio

Install Istio binaries on the machine:

```bash
curl -L https://istio.io/downloadIstio | ISTIO_VERSION=1.16.1 TARGET_ARCH=x86_64 sh -
export PATH="$PATH:$PWD/istio-1.16.1/bin"

```

Install Istio on the Kubernetes cluster:

```bash

kubectl create namespace istio-system

istioctl operator init

kubectl apply -f - <<EOF
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: istio-gateway
  namespace: istio-system
spec:
  addonComponents:
    grafana:
      enabled: false
    kiali:
      enabled: false
    prometheus:
      enabled: false
    tracing:
      enabled: false
  components:
    ingressGateways:
      - enabled: true
        k8s:
          hpaSpec:
            minReplicas: 1
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
          service:
            ports:
              - name: http
                port: 80
                targetPort: 8080
                nodePort: 30949
              - name: https
                port: 443
                targetPort: 8443
                nodePort: 30950
            type: NodePort
        name: istio-ingressgateway
    pilot:
      enabled: true
      k8s:
        hpaSpec:
          minReplicas: 1
        resources:
          limits:
            cpu: 300m
            memory: 512Mi
          requests:
            cpu: 100m
            memory: 128Mi
  meshConfig:
    accessLogFile: /dev/stdout
    enableTracing: false
    outboundTrafficPolicy:
      mode: ALLOW_ANY
  profile: default

EOF

```

## Deploy a `Peer` organization

### Environment Variables for AMD (Default)

```bash
export PEER_IMAGE=hyperledger/fabric-peer
export PEER_VERSION=2.4.6

export ORDERER_IMAGE=hyperledger/fabric-orderer
export ORDERER_VERSION=2.4.6

export CA_IMAGE=hyperledger/fabric-ca
export CA_VERSION=1.5.6-beta2
```

### Environment Variables for ARM (Mac M1)

```bash
export PEER_IMAGE=bswamina/fabric-peer
export PEER_VERSION=2.4.6

export ORDERER_IMAGE=bswamina/fabric-orderer
export ORDERER_VERSION=2.4.6

export CA_IMAGE=hyperledger/fabric-ca
export CA_VERSION=1.5.6-beta2

```

### Configure Internal DNS

```bash
CLUSTER_IP=$(kubectl -n istio-system get svc istio-ingressgateway -o json | jq -r .spec.clusterIP)
kubectl apply -f - <<EOF
kind: ConfigMap
apiVersion: v1
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        rewrite name regex (.*)\.localho\.st host.ingress.internal
        hosts {
          ${CLUSTER_IP} host.ingress.internal
          fallthrough
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
EOF

```

### Deploy a certificate authority for Org1MSP

```bash

kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=standard --capacity=1Gi --name=org1-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=org1-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```

Check that the certification authority is deployed and works:

```bash
curl -k https://org1-ca.localho.st:443/cainfo
```

Register a user in the certification authority of the peer organization (Org1MSP)

```bash
# register user in CA for peers
kubectl hlf ca register --name=org1-ca --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org1MSP

```

### Deploy two peers for Org1MSP

```bash
kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=Org1MSP \
        --enroll-pw=peerpw --capacity=5Gi --name=org1-peer0 --ca-name=org1-ca.default \
        --hosts=peer0-org1.localho.st --istio-port=443


kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=Org1MSP \
        --enroll-pw=peerpw --capacity=5Gi --name=org1-peer1 --ca-name=org1-ca.default \
        --hosts=peer1-org1.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabricpeers.hlf.kungfusoftware.es --all
```

Check that the peer is deployed and works:

```bash
openssl s_client -connect peer0-org1.localho.st:443
openssl s_client -connect peer1-org1.localho.st:443
```

### Deploy a certificate authority for Org2MSP

```bash

kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=standard --capacity=1Gi --name=org2-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=org2-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```

Check that the certification authority is deployed and works:

```bash
curl -k https://org2-ca.localho.st:443/cainfo
```

Register a user in the certification authority of the peer organization (Org2MSP)

```bash
# register user in CA for peers
kubectl hlf ca register --name=org2-ca --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org2MSP

```

### Deploy two peers for Org2MSP

```bash
kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=Org2MSP \
        --enroll-pw=peerpw --capacity=5Gi --name=org2-peer0 --ca-name=org2-ca.default \
        --hosts=peer0-org2.localho.st --istio-port=443


kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=Org2MSP \
        --enroll-pw=peerpw --capacity=5Gi --name=org2-peer1 --ca-name=org2-ca.default \
        --hosts=peer1-org2.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabricpeers.hlf.kungfusoftware.es --all
```

Check that the peer is deployed and works:

```bash
openssl s_client -connect peer0-org2.localho.st:443
openssl s_client -connect peer1-org2.localho.st:443
```

## Deploy an `Orderer` organization

To deploy an `Orderer` organization we have to:

1. Create a certification authority
2. Register user `orderer` with password `ordererpw`
3. Create orderers

### Create the certification authority

```bash

kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=standard --capacity=1Gi --name=ord-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=ord-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all

```

Check that the certification authority is deployed and works:

```bash
curl -vik https://ord-ca.localho.st:443/cainfo
```

### Register user `orderer`

```bash
kubectl hlf ca register --name=ord-ca --user=orderer --secret=ordererpw \
    --type=orderer --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP --ca-url="https://ord-ca.localho.st:443"

```

### Deploy orderer

```bash

kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=standard --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=2Gi --name=ord-node0 --ca-name=ord-ca.default \
    --hosts=orderer0-ord.localho.st --istio-port=443

kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=standard --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=2Gi --name=ord-node1 --ca-name=ord-ca.default \
    --hosts=orderer1-ord.localho.st --istio-port=443

kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=standard --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=2Gi --name=ord-node2 --ca-name=ord-ca.default \
    --hosts=orderer2-ord.localho.st --istio-port=443


kubectl wait --timeout=180s --for=condition=Running fabricorderernodes.hlf.kungfusoftware.es --all
```

Check that the orderer is running:

```bash
kubectl get pods
```

```bash
openssl s_client -connect orderer0-ord.localho.st:443
openssl s_client -connect orderer1-ord.localho.st:443
openssl s_client -connect orderer2-ord.localho.st:443
```

## Create channel

To create the channel we need to first create the wallet secret, which will contain the identities used by the operator to manage the channel

### Register and enrolling OrdererMSP identity

```bash
# register
kubectl hlf ca register --name=ord-ca --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP

# enroll
kubectl hlf ca enroll --name=ord-ca --namespace=default \
    --user=admin --secret=adminpw --mspid OrdererMSP \
    --ca-name tlsca  --output resources/orderermsp.yaml

```

### Register and enrolling Org1MSP identity

```bash
# register
kubectl hlf ca register --name=org1-ca --namespace=default --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=Org1MSP

# enroll
kubectl hlf ca enroll --name=org1-ca --namespace=default \
    --user=admin --secret=adminpw --mspid Org1MSP \
    --ca-name ca  --output resources/org1msp.yaml

```

### Register and enrolling Org2MSP identity

```bash
# register
kubectl hlf ca register --name=org2-ca --namespace=default --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=Org2MSP

# enroll
kubectl hlf ca enroll --name=org2-ca --namespace=default \
    --user=admin --secret=adminpw --mspid Org2MSP \
    --ca-name ca  --output resources/org2msp.yaml

```

### Create the secret

```bash

kubectl create secret generic wallet --namespace=default \
        --from-file=org1msp.yaml=$PWD/resources/org1msp.yaml \
        --from-file=org2msp.yaml=$PWD/resources/org2msp.yaml \
        --from-file=orderermsp.yaml=$PWD/resources/orderermsp.yaml
```

### Create main channel

```bash
export PEER_ORG_SIGN_CERT=$(kubectl get fabriccas org1-ca -o=jsonpath='{.status.ca_cert}')
export PEER_ORG_TLS_CERT=$(kubectl get fabriccas org1-ca -o=jsonpath='{.status.tlsca_cert}')
export IDENT_8=$(printf "%8s" "")
export ORDERER_TLS_CERT=$(kubectl get fabriccas ord-ca -o=jsonpath='{.status.tlsca_cert}' | sed -e "s/^/${IDENT_8}/" )
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node0 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )
export ORDERER1_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )
export ORDERER2_TLS_CERT=$(kubectl get fabricorderernodes ord-node2 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricMainChannel
metadata:
  name: demo
spec:
  name: demo
  adminOrdererOrganizations:
    - mspID: OrdererMSP
  adminPeerOrganizations:
    - mspID: Org1MSP
  channelConfig:
    application:
      acls: null
      capabilities:
        - V2_0
      policies: null
    capabilities:
      - V2_0
    orderer:
      batchSize:
        absoluteMaxBytes: 1048576
        maxMessageCount: 120
        preferredMaxBytes: 524288
      batchTimeout: 2s
      capabilities:
        - V2_0
      etcdRaft:
        options:
          electionTick: 10
          heartbeatTick: 1
          maxInflightBlocks: 5
          snapshotIntervalSize: 16777216
          tickInterval: 500ms
      ordererType: etcdraft
      policies: null
      state: STATE_NORMAL
    policies: null
  externalOrdererOrganizations: []
  peerOrganizations:
    - mspID: Org1MSP
      caName: "org1-ca"
      caNamespace: "default"
    - mspID: Org2MSP
      caName: "org2-ca"
      caNamespace: "default"
  identities:
    OrdererMSP:
      secretKey: orderermsp.yaml
      secretName: wallet
      secretNamespace: default
    Org1MSP:
      secretKey: org1msp.yaml
      secretName: wallet
      secretNamespace: default
  externalPeerOrganizations: []
  ordererOrganizations:
    - caName: "ord-ca"
      caNamespace: "default"
      externalOrderersToJoin:
        - host: ord-node0
          port: 7053
        - host: ord-node1
          port: 7053
        - host: ord-node2
          port: 7053
      mspID: OrdererMSP
      ordererEndpoints:
        - orderer0-ord.localho.st:443
        - orderer1-ord.localho.st:443
        - orderer2-ord.localho.st:443
      orderersToJoin: []
  orderers:
    - host: orderer0-ord.localho.st
      port: 443
      tlsCert: |-
${ORDERER0_TLS_CERT}
    - host: orderer1-ord.localho.st
      port: 443
      tlsCert: |-
${ORDERER1_TLS_CERT}
    - host: orderer2-ord.localho.st
      port: 443
      tlsCert: |-
${ORDERER2_TLS_CERT}

EOF

```

## Org1MSP Join peer to the channel

```bash

export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node0 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: demo-org1msp
spec:
  anchorPeers:
    - host: peer0-org1.localho.st
      port: 443
    - host: peer1-org1.localho.st
      port: 443
  hlfIdentity:
    secretKey: org1msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org1MSP
  name: demo
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://orderer0-ord.localho.st:443
  peersToJoin:
    - name: org1-peer0
      namespace: default
    - name: org1-peer1
      namespace: default
EOF


```

## Org2MSP Join peer to the channel

```bash

export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node0 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: demo-org2msp
spec:
  anchorPeers:
    - host: peer0-org2.localho.st
      port: 7051
    - host: peer1-org2.localho.st
      port: 7051
  hlfIdentity:
    secretKey: org2msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org2MSP
  name: demo
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://orderer0-ord.localho.st:443
  peersToJoin:
    - name: org2-peer0
      namespace: default
    - name: org2-peer1
      namespace: default
EOF

```

## Install a chaincode

### Prepare connection string for a peer

To prepare the connection string, we have to:

1. Get connection string without users for organization Org1MSP and OrdererMSP
2. Register a user in the certification authority for signing (register)
3. Obtain the certificates using the previously created user (enroll)
4. Attach the user to the connection string

5. Get connection string without users for organization Org1MSP and OrdererMSP

```bash
kubectl hlf inspect -c=demo --output resources/network.yaml -o Org1MSP -o Org2MSP -o OrdererMSP
```

2. Register a user in the certification authority for signing

```bash
kubectl hlf ca register --name=org1-ca --user=admin --secret=adminpw --type=admin \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org1MSP
```

3. Get the certificates using the user created above

```bash
kubectl hlf ca enroll --name=org1-ca --user=admin --secret=adminpw --mspid Org1MSP \
        --ca-name ca  --output resources/peer-org1.yaml
```

4. Attach the user to the connection string

```bash
kubectl hlf utils adduser --userPath=resources/peer-org1.yaml --config=resources/network.yaml --username=admin --mspid=Org1MSP
```

5. Register a user in the certification authority for signing

```bash
kubectl hlf ca register --name=org2-ca --user=admin --secret=adminpw --type=admin \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org2MSP
```

6. Get the certificates using the user created above

```bash
kubectl hlf ca enroll --name=org2-ca --user=admin --secret=adminpw --mspid Org2MSP \
        --ca-name ca  --output resources/peer-org2.yaml
```

7. Attach the user to the connection string

```bash
kubectl hlf utils adduser --userPath=resources/peer-org2.yaml --config=resources/network.yaml --username=admin --mspid=Org2MSP
```

### Create metadata file

```bash
# remove the code.tar.gz chaincode.tgz if they exist
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=asset
export CHAINCODE_LABEL=asset
cat << METADATA-EOF > "metadata.json"
{
    "type": "ccaas",
    "label": "${CHAINCODE_LABEL}"
}
METADATA-EOF
```

### Prepare connection file

```bash
## chaincode as a service
cat > "connection.json" <<CONN_EOF
{
  "address": "${CHAINCODE_NAME}:7052",
  "dial_timeout": "10s",
  "tls_required": false
}
CONN_EOF

tar cfz code.tar.gz connection.json
tar cfz chaincode.tgz metadata.json code.tar.gz
export PACKAGE_ID=$(kubectl hlf chaincode calculatepackageid --path=chaincode.tgz --language=node --label=$CHAINCODE_LABEL)
echo "PACKAGE_ID=$PACKAGE_ID"

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=resources/network.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer0.default
kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=resources/network.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer1.default


kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=resources/network.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org2-peer0.default
kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=resources/network.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org2-peer1.default

```

## Build chaincode docker image

Set up environment variables, make sure you use your own docker image name:

```bash
export IMAGE="kfsoftware/asset-transfer-basic-ts:latest"
```

### Build the docker image

If you are using Mac M1, you need to specify platform linux/amd64:
```bash
docker build -t $IMAGE --platform=linux/amd64 --file=./asset-transfer-basic/Dockerfile ./asset-transfer-basic
```

Otherwise, just run:

```bash
docker build -t $IMAGE --file=./asset-transfer-basic/Dockerfile ./asset-transfer-basic
```


### Push the docker image
Push the docker image to the container registry:

```bash
docker push $IMAGE
```

## Deploy chaincode container on cluster

The following command will create or update the CRD based on the packageID, chaincode name, and docker image.

```bash
kubectl hlf externalchaincode sync --image=$IMAGE \
    --name=$CHAINCODE_NAME \
    --namespace=default \
    --package-id=$PACKAGE_ID \
    --tls-required=false \
    --replicas=1
```

## Check installed chaincodes

```bash
kubectl hlf chaincode queryinstalled --config=resources/network.yaml --user=admin --peer=org1-peer0.default
```

## Approve chaincode - Org1MSP

```bash
export SEQUENCE=1
export VERSION="1.0"
kubectl hlf chaincode approveformyorg --config=resources/network.yaml --user=admin --peer=org1-peer0.default \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name=asset \
    --policy="AND('Org1MSP.member', 'Org2MSP.member')" --channel=demo
```

## Approve chaincode - Org2MSP

```bash
export SEQUENCE=1
export VERSION="1.0"
kubectl hlf chaincode approveformyorg --config=resources/network.yaml --user=admin --peer=org2-peer0.default \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name=asset \
    --policy="AND('Org1MSP.member', 'Org2MSP.member')" --channel=demo
```

## Commit chaincode

```bash
kubectl hlf chaincode commit --config=resources/network.yaml --user=admin --mspid=Org1MSP \
    --version "$VERSION" --sequence "$SEQUENCE" --name=asset \
    --policy="AND('Org1MSP.member', 'Org2MSP.member')" --channel=demo
```

## Invoke a transaction on the channel

```bash
kubectl hlf chaincode invoke --config=resources/network.yaml \
    --user=admin --peer=org1-peer0.default \
    --chaincode=asset --channel=demo \
    --fcn=InitLedger
```

## Query assets in the channel

```bash
kubectl hlf chaincode query --config=resources/network.yaml \
    --user=admin --peer=org1-peer0.default \
    --chaincode=asset --channel=demo \
    --fcn=GetAllAssets
```


## Launch the API

For this step, head over the `client` folder and follow the README instructions.


## End of the tutorial

At this point, you should have:

- Ordering service with 3 nodes and a CA
- 2 Peer organizations with two peers and a CA
- A channel **demo**
- A chaincode installed in all peers
- A chaincode approved and committed
- 2 APIs running for the two different organizations

If something went wrong or didn't work, please, open an issue.

## Cleanup the environment

```bash
kubectl delete fabricorderernodes.hlf.kungfusoftware.es --all-namespaces --all
kubectl delete fabricpeers.hlf.kungfusoftware.es --all-namespaces --all
kubectl delete fabriccas.hlf.kungfusoftware.es --all-namespaces --all
kubectl delete fabricchaincode.hlf.kungfusoftware.es --all-namespaces --all
kubectl delete fabricmainchannels --all-namespaces --all
kubectl delete fabricfollowerchannels --all-namespaces --all
```

