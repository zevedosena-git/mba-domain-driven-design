import { CustomerId } from '../../@core/events/domain/entities/customer.entity';
import { WaitingListEntry } from '../../@core/events/domain/entities/waiting-list-entry';
import { WaitingListController } from './waiting-list.controller';

test('controller só delega e o ingresso traz status PENDING', async () => {
  const customerId = new CustomerId();
  const entry = WaitingListEntry.create({
    customer_id: customerId,
    position: 1,
  });
  const service = {
    join: jest.fn().mockResolvedValue(entry),
    list: jest.fn().mockResolvedValue([entry]),
  };
  const controller = new WaitingListController(service as never);

  const joined = await controller.join('event-id', 'section-id', {
    customer_id: customerId.value,
  });
  const listed = await controller.list('event-id', 'section-id');

  expect(service.join).toHaveBeenCalledWith({
    event_id: 'event-id',
    section_id: 'section-id',
    customer_id: customerId.value,
  });
  expect(service.list).toHaveBeenCalledWith('event-id', 'section-id');
  expect(JSON.stringify(joined)).toContain('"status":"PENDING"');
  expect(listed).toEqual([entry]);
});
