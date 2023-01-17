# API

Este API expone via HTTP las operaciones que se pueden realizar sobre el chaincode Productos.

## Instalar librerias
```bash
npm install
```

## Lanzar el servidor para Marketplace

Lanzar el servidor para la Marketplace

```bash
npm run server:marketplace:dev
```

## Lanzar el servidor para Sony

Lanzar el servidor para la Sony

```bash
npm run server:sony:dev
```

## Operaciones

Hay 2 APIs:

Marketplace: http://localhost:3003
Sony:        http://localhost:3004

### Verificar conectividad con el smart contract

Marketplace:
```bash
http GET "http://localhost:3003/ping"
```
Sony:
```bash
http GET "http://localhost:3004/ping"
```

Debe devolver `pong` en ambos casos

### Registrar un usuario

```bash
http POST "http://localhost:3004/signup" username="user1" password="user1pw"
```

### Logearnos con el usuario

Esta operacion se tiene que hacer siempre que el programa se reinicie

```bash
http POST "http://localhost:3004/login" username="user1" password="user1pw"
```

### Crear un Producto

```bash
http POST "http://localhost:3004/submit" x-user:user1 fcn=createProduct "args[]=1"  \
        "args[]=PS5" "args[]=Play Station 5" "args[]=699" "args[]=10"
```

### Obtener un Producto

```bash
http POST "http://localhost:3004/evaluate" x-user:user1 fcn=getProduct "args[]=1"
```

### Registrar usuario en Marketplace

```bash
http POST "http://localhost:3003/signup" username="user2" password="user2pw"
```

### Logearnos con otro usuario

Esta operacion se tiene que hacer siempre que el programa se reinicie

```bash
http POST "http://localhost:3003/login" username="user2" password="user2pw"
```

## Add fondos a nuestra cuenta

Esta operacion en produccion deberia de estar relacionado con un mecanismo de pago

```bash
http POST "http://localhost:3003/submit" x-user:user2 fcn=setMyBalance "args[]=3000"

```

## Obtener nuestros fondos

Esta operacion en produccion deberia de estar relacionado con un mecanismo de pago

```bash
http POST "http://localhost:3003/evaluate" x-user:user2 fcn=getMyBalance

```

## Comprar un producto

```bash
http POST "http://localhost:3003/submit" x-user:user2 fcn=comprar "args[]=1" "args[]=1"
```

## Comprobar que nuestro balance ha sido actualizado

```bash
http POST "http://localhost:3003/evaluate" x-user:user2 fcn=getMyBalance
```

## Obtener productos comprados

```bash
http POST "http://localhost:3003/evaluate" x-user:user2 fcn=getMyVentas
```

## Comprobar que no podemos comprar mas de 10 productos

```bash
http POST "http://localhost:3003/submit" x-user:user2 fcn=comprar "args[]=1" "args[]=12"
```
