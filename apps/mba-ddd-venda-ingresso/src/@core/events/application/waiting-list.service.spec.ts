import { MikroORM, MySqlDriver } from '@mikro-orm/mysql';
import { ApplicationService } from '../../common/application/application.service';
import { DomainEventManager } from '../../common/domain/domain-event-manager';
import { UnitOfWorkMikroOrm } from '../../common/infra/unit-of-work-mikro-orm';
import { Customer } from '../domain/entities/customer.entity';
import { CustomerId } from '../domain/entities/customer.entity';
import { EventId } from '../domain/entities/event.entity';
import { EventSectionId } from '../domain/entities/event-section';
import { Partner } from '../domain/entities/partner.entity';
import { WaitingListEntryStatus } from '../domain/entities/waiting-list-entry';
import {
  CustomerSchema,
  EventSchema,
  EventSectionSchema,
  EventSpotSchema,
  PartnerSchema,
  WaitingListEntrySchema,
  WaitingListSchema,
} from '../infra/db/schemas';
import { CustomerMysqlRepository } from '../infra/db/repositories/customer-mysql.repository';
import { EventMysqlRepository } from '../infra/db/repositories/event-mysql.repository';
import { PartnerMysqlRepository } from '../infra/db/repositories/partner-mysql.repository';
import { WaitingListMysqlRepository } from '../infra/db/repositories/waiting-list-mysql.repository';
import { WaitingListService } from './waiting-list.service';

test('entrar na fila valida esgotamento e devolve PENDING', async () => {
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
  const uow = new UnitOfWorkMikroOrm(em);
  const applicationService = new ApplicationService(
    uow,
    new DomainEventManager(),
  );
  const customerRepo = new CustomerMysqlRepository(em);
  const partnerRepo = new PartnerMysqlRepository(em);
  const eventRepo = new EventMysqlRepository(em);
  const waitingListRepo = new WaitingListMysqlRepository(em);
  const service = new WaitingListService(
    waitingListRepo,
    customerRepo,
    eventRepo,
    applicationService,
  );

  const customer = Customer.create({
    name: 'Customer 1',
    cpf: '99346413050',
  });
  await customerRepo.add(customer);
  const partner = Partner.create({ name: 'Partner 1' });
  await partnerRepo.add(partner);
  const event = partner.initEvent({
    name: 'Event 1',
    description: 'Event 1',
    date: new Date(),
  });
  event.addSection({
    name: 'Section 1',
    description: 'Section 1',
    price: 100,
    total_spots: 1,
  });
  event.publishAll();
  await eventRepo.add(event);
  await uow.commit();

  const section = [...event.sections][0];
  const spot = [...section.spots][0];

  await expect(service.list(event.id.value, section.id.value)).resolves.toEqual(
    [],
  );

  await expect(
    service.join({
      event_id: event.id.value,
      section_id: section.id.value,
      customer_id: new CustomerId().value,
    }),
  ).rejects.toThrow('Customer not found');

  await expect(
    service.join({
      event_id: new EventId().value,
      section_id: section.id.value,
      customer_id: customer.id.value,
    }),
  ).rejects.toThrow('Event not found');

  await expect(
    service.join({
      event_id: event.id.value,
      section_id: new EventSectionId().value,
      customer_id: customer.id.value,
    }),
  ).rejects.toThrow('Section not found');

  await expect(
    service.join({
      event_id: event.id.value,
      section_id: section.id.value,
      customer_id: customer.id.value,
    }),
  ).rejects.toThrow('Section is not sold out');

  event.markSpotAsReserved({
    section_id: section.id,
    spot_id: spot.id,
  });
  await eventRepo.add(event);
  await uow.commit();

  const entry = await service.join({
    event_id: event.id.value,
    section_id: section.id.value,
    customer_id: customer.id.value,
  });

  expect(entry.status).toBe(WaitingListEntryStatus.PENDING);
  expect(JSON.stringify(entry)).toContain('"status":"PENDING"');
  expect(entry.toJSON().customer_id).toBe(customer.id.value);

  const listed = await service.list(event.id.value, section.id.value);
  expect(listed).toHaveLength(1);
  expect(listed[0].customer_id.equals(customer.id)).toBe(true);
  expect(listed[0].toJSON().status).toBe('PENDING');

  await orm.close();
});
