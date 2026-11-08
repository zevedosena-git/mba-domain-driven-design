import { EventSectionId } from '../event-section';
import { EventSpotId } from '../event-spot';
import { EventId } from '../event.entity';
import { CustomerId } from '../customer.entity';
import { CustomerJoinedWaitingList } from '../../events/domain-events/customer-joined-waiting-list.event';
import { SpotOfferedToWaitingCustomer } from '../../events/domain-events/spot-offered-to-waiting-customer.event';
import { WaitingList } from '../waiting-list.entity';
import { WaitingListEntryStatus } from '../waiting-list-entry';
import { initOrm } from './helpers';

describe('WaitingList', () => {
  initOrm();

  const createList = () =>
    WaitingList.create({
      event_id: new EventId(),
      section_id: new EventSectionId(),
    });

  test('recusa outro PENDING do mesmo cliente', () => {
    const list = createList();
    const customerId = new CustomerId();
    list.join(customerId);
    const snapshot = list.toJSON();

    expect(() => list.join(customerId)).toThrow(
      'Customer already in waiting list',
    );
    expect(list.toJSON()).toEqual(snapshot);
  });

  test('promove a primeira entrada e registra o evento', () => {
    const list = createList();
    const firstCustomer = new CustomerId();
    const secondCustomer = new CustomerId();
    const spotId = new EventSpotId();
    const first = list.join(firstCustomer);
    const second = list.join(secondCustomer);

    expect(
      [...list.events].some(
        (event) => event instanceof CustomerJoinedWaitingList,
      ),
    ).toBe(true);

    list.offerSpot(spotId);

    expect(first.status).toBe(WaitingListEntryStatus.NOTIFIED);
    expect(second.status).toBe(WaitingListEntryStatus.PENDING);
    const offered = [...list.events].find(
      (event) => event instanceof SpotOfferedToWaitingCustomer,
    ) as SpotOfferedToWaitingCustomer;
    expect(offered.customer_id.equals(firstCustomer)).toBe(true);
    expect(offered.event_id.equals(list.event_id)).toBe(true);
    expect(offered.section_id.equals(list.section_id)).toBe(true);
    expect(offered.spot_id.equals(spotId)).toBe(true);
  });

  test('oferta sem pendente não muda a lista', () => {
    const list = createList();
    const customerId = new CustomerId();
    list.join(customerId);
    list.offerSpot(new EventSpotId());
    const snapshot = list.toJSON();
    const eventsBefore = list.events.size;

    list.offerSpot(new EventSpotId());

    expect(list.toJSON()).toEqual(snapshot);
    expect(list.events.size).toBe(eventsBefore);
  });

  test('cliente só NOTIFIED pode entrar de novo', () => {
    const list = createList();
    const customerId = new CustomerId();
    list.join(customerId);
    list.offerSpot(new EventSpotId());

    const again = list.join(customerId);

    expect(again.status).toBe(WaitingListEntryStatus.PENDING);
    expect(again.position).toBe(2);
    expect(again.toJSON().status).toBe('PENDING');
  });
});
