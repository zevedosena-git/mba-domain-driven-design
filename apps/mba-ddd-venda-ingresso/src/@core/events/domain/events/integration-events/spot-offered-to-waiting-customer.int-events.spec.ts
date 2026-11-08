import { CustomerId } from '../../entities/customer.entity';
import { EventSectionId } from '../../entities/event-section';
import { EventSpotId } from '../../entities/event-spot';
import { EventId } from '../../entities/event.entity';
import { WaitingListId } from '../../entities/waiting-list.entity';
import { SpotOfferedToWaitingCustomer } from '../domain-events/spot-offered-to-waiting-customer.event';
import { SpotOfferedToWaitingCustomerIntegrationEvent } from './spot-offered-to-waiting-customer.int-events';

test('payload do evento de integração leva os quatro ids', () => {
  const domainEvent = new SpotOfferedToWaitingCustomer(
    new WaitingListId(),
    new CustomerId(),
    new EventId(),
    new EventSectionId(),
    new EventSpotId(),
  );

  const integrationEvent = new SpotOfferedToWaitingCustomerIntegrationEvent(
    domainEvent,
  );

  expect(integrationEvent.event_name).toBe(
    'SpotOfferedToWaitingCustomerIntegrationEvent',
  );
  expect(integrationEvent.payload).toEqual({
    customer_id: domainEvent.customer_id.value,
    event_id: domainEvent.event_id.value,
    section_id: domainEvent.section_id.value,
    spot_id: domainEvent.spot_id.value,
  });
  expect(Object.keys(integrationEvent.payload)).toEqual([
    'customer_id',
    'event_id',
    'section_id',
    'spot_id',
  ]);
});
