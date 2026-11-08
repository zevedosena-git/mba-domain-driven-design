# MBA Full Cycle - Domain Driven Design

Este repositório contém o código-fonte e material didático do curso de Domain Driven Design do MBA Full Cycle.

O projeto é feito com Nestjs, mas o conteúdo é independente de linguagem ou framework.

## Pré-requisitos

- Node.js 18+
- Docker

## Executar o projeto

Suba as aplicações MySQL, RabbitMQ e Redis:

```bash
docker-compose up -d
```

Instale as dependências do Node.js:

```bash
npm install
```

O projeto não traz migrações. Recrie as tabelas, inclusive `stored_event`, a partir do `mikro-orm.config.ts`:

```bash
npx mikro-orm schema:fresh --run
```

Suba a API na porta 3000 e o app de e-mails na porta 3001:

```bash
npm run start:dev
npx nest start emails
```

Rode a suíte:

```bash
npm test
```

Cada teste de infraestrutura recria o schema com `refreshDatabase()` e não registra `StoredEventSchema`. Isso derruba a tabela `stored_event`. Sem ela, a API responde 500 na primeira operação, porque o listener wildcard tenta gravar o evento. Depois dos testes, rode `npx mikro-orm schema:fresh --run` de novo antes de subir a API.

Use o arquivo `api.http` como referência para fazer as requisições HTTP. Este arquivo funciona com a extensão [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) do VSCode.

## Lista de espera

A `WaitingList` fica fora do `Event` porque tem ciclo e invariantes próprios: entrada só com a seção esgotada, uma fila por evento e seção, recusa de outro `PENDING` do mesmo cliente e promoção da primeira entrada. A consistência com o lugar não é imediata; ela só chega por evento de domínio. O `Event` continua sendo a fronteira de seções e lugares. Levar a fila para dentro dele aumentaria o agregado que a compra já carrega inteiro e faria o comando de cancelamento conhecer a fila.

O comando é `OrderService.cancel`, dentro de `ApplicationService.run`. Ele só muda o pedido para `CANCELLED` e registra `OrderCancelled`. O `OrderCancelledHandler` localiza o `Event` pelo lugar, devolve o spot, remove a `SpotReservation` e o agregado registra `EventSpotReleased`. O `EventSpotReleasedHandler` chama a oferta da `WaitingList`: a primeira entrada `PENDING` passa a `NOTIFIED` e o agregado registra `SpotOfferedToWaitingCustomer`. Esse evento vira `SpotOfferedToWaitingCustomerIntegrationEvent`, com `customer_id`, `event_id`, `section_id` e `spot_id`, e entra na fila Bull `integration-events`. O `IntegrationEventsPublisher` permanece como está e publica no RabbitMQ. O `apps/emails` consome com um `@RabbitSubscribe` próprio na fila `emails.spot-offered` e registra cliente e seção no log. A entrada da fila não é agregado: o cascade a coloca no persist stack, e o `ApplicationService` publica todo item desse stack. A entrada expõe `events` vazio para esse publish seguir sem registrar evento e sem reescrever o mecanismo. O evento de domínio continua só na `WaitingList`.

- [Event storming](docs/event-storming.excalidraw)
- [Linguagem ubíqua](docs/linguagem-ubiqua.md)

## Professor

<a href="https://github.com/argentinaluiz">
    <img src="https://avatars.githubusercontent.com/u/4926329?v=4?s=100" width="100px;" alt=""/>
    <br />
    <sub>
        <b>Luiz Carlos</b>
    </sub>
</a>
