import { MikroORM, MySqlDriver } from '@mikro-orm/mysql';
import { Customer } from '../../../../domain/entities/customer.entity';
import { Partner } from '../../../../domain/entities/partner.entity';
import { WaitingListEntryStatus } from '../../../../domain/entities/waiting-list-entry';
import { WaitingList } from '../../../../domain/entities/waiting-list.entity';
import {
  CustomerSchema,
  EventSchema,
  EventSectionSchema,
  EventSpotSchema,
  PartnerSchema,
  WaitingListEntrySchema,
  WaitingListSchema,
} from '../../schemas';
import { CustomerMysqlRepository } from '../customer-mysql.repository';
import { EventMysqlRepository } from '../event-mysql.repository';
import { PartnerMysqlRepository } from '../partner-mysql.repository';
import { WaitingListMysqlRepository } from '../waiting-list-mysql.repository';

test('WaitingList repository recarrega as entradas na ordem de position', async () => {
  const orm = await MikroORM.init<MySqlDriver>({
    entities: [
      CustomerSchema,
      PartnerSchema,
      EventSchema,
      EventSectionSchema,
      EventSpotSchema,
      WaitingListSchema,
      WaitingListEntrySchema,
    ],
    dbName: 'events',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    type: 'mysql',
    forceEntityConstructor: true,
  });
  await orm.schema.refreshDatabase();
  const em = orm.em.fork();
  const partnerRepo = new PartnerMysqlRepository(em);
  const eventRepo = new EventMysqlRepository(em);
  const customerRepo = new CustomerMysqlRepository(em);
  const waitingListRepo = new WaitingListMysqlRepository(em);

  const partner = Partner.create({ name: 'Partner 1' });
  await partnerRepo.add(partner);
  const event = partner.initEvent({
    name: 'Event 1',
    date: new Date(),
    description: 'Event 1 description',
  });
  event.addSection({
    name: 'Section 1',
    description: 'Section 1 description',
    price: 100,
    total_spots: 2,
  });
  await eventRepo.add(event);

  const customerA = Customer.create({
    name: 'Customer A',
    cpf: '99346413050',
  });
  const customerB = Customer.create({
    name: 'Customer B',
    cpf: '70375887091',
  });
  await customerRepo.add(customerA);
  await customerRepo.add(customerB);
  await em.flush();

  const section = [...event.sections][0];
  const waitingList = WaitingList.create({
    event_id: event.id,
    section_id: section.id,
  });
  waitingList.join(customerA.id);
  waitingList.join(customerB.id);
  await waitingListRepo.add(waitingList);
  await em.flush();
  await em.clear();

  const found = await waitingListRepo.findByEventAndSection(
    event.id,
    section.id,
  );
  const entries = [...found.entries];

  expect(entries).toHaveLength(2);
  expect(entries.map((entry) => entry.position)).toEqual([1, 2]);
  expect(entries[0].customer_id.equals(customerA.id)).toBe(true);
  expect(entries[1].customer_id.equals(customerB.id)).toBe(true);
  expect(entries[0].status).toBe(WaitingListEntryStatus.PENDING);
  expect(entries[1].status).toBe(WaitingListEntryStatus.PENDING);

  await orm.close();
});
