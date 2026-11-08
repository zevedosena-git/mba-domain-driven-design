# Linguagem ubíqua

## Pedido (`Order`)

Compra de um lugar por um cliente, com valor e status pendente, pago ou cancelado.

## Cancelamento (`OrderCancelled`)

Fato de o pedido ter passado a `CANCELLED`, carregando o id do pedido, o status e o `event_spot_id`.

## Lugar (`EventSpot`)

Assento de uma seção. Fica indisponível para nova reserva enquanto `is_reserved` é verdadeiro.

## Liberação de lugar (`EventSpotReleased`)

Fato de o `Event` ter devolvido o lugar, com o id do evento, o da seção e o do lugar.

## Trava de reserva (`SpotReservation`)

Registro que segura o lugar para o cliente durante a compra e sai quando o lugar é liberado.

## Lista de espera (`WaitingList`)

Fila de uma seção de um evento, identificada pelo par `event_id` + `section_id`, fora do `Event`.

## Entrada (`WaitingListEntry`)

Cliente na fila, com status e `position` na ordem de chegada.

## Notificação (`SpotOfferedToWaitingCustomer`)

Aviso ao primeiro `PENDING`: a entrada passa a `NOTIFIED` e o evento leva cliente, evento, seção e lugar.

## Oferta de lugar (`offerSpot`)

Operação da `WaitingList` que promove a primeira entrada `PENDING` a `NOTIFIED`. Sem entrada pendente, não faz nada.

## Política (`EventSpotReleasedHandler`)

Reação ao lugar liberado que oferece a vaga ao primeiro da fila, sem reservar o lugar.

## Evento de integração (`SpotOfferedToWaitingCustomerIntegrationEvent`)

A notificação saindo do processo, com `customer_id`, `event_id`, `section_id` e `spot_id`, até o contexto de e-mails.

## Seção esgotada (`isSectionSoldOut`)

Seção em que nenhum lugar está disponível para reserva. É a condição para entrar na lista de espera.
