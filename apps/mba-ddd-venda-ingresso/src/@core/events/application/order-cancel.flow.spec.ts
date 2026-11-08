import { MikroORM, MySqlDriver } from '@mikro-orm/mysql';
import { ApplicationService } from '../../common/application/application.service';
import { DomainEventManager } from '../../common/domain/domain-event-manager';
import { UnitOfWorkMikroOrm } from '../../common/infra/unit-of-work-mikro-orm';
import { Customer } from '../domain/entities/customer.entity';
import { Partner } from '../domain/entities/partner.entity';
import { WaitingListEntryStatus } from '../domain/entities/waiting-list-entry';
import { OrderCancelledHandler } from './handlers/order-cancelled.handler';
import { EventSpotReleasedHandler } from './handlers/event-spot-released.handler';
import {
  CustomerSchema,
  EventSchema,
  EventSectionSchema,
  EventSpotSchema,
  OrderSchema,
  PartnerSchema,
  SpotReservationSchema,
  WaitingListEntrySchema,
  WaitingListSchema,
} from '../infra/db/schemas';
import { CustomerMysqlRepository } from '../infra/db/repositories/customer-mysql.repository';
import { EventMysqlRepository } from '../infra/db/repositories/event-mysql.repository';
import { OrderMysqlRepository } from '../infra/db/repositories/order-mysql.repository';
import { PartnerMysqlRepository } from '../infra/db/repositories/partner-mysql.repository';
import { SpotReservationMysqlRepository } from '../infra/db/repositories/spot-reservation-mysql.repository';
import { WaitingListMysqlRepository } from '../infra/db/repositories/waiting-list-mysql.repository';
import { OrderService } from './order.service';
import { PaymentGateway } from './payment.gateway';
import { WaitingListService } from './waiting-list.service';

test('cancelamento em processo libera o lugar e notifica a primeira entrada', async () => {
  const orm = await MikroORM.init<MySqlDriver>({
    entities: [
      CustomerSchema,
      PartnerSchema,
      EventSchema,
      EventSectionSchema,
      EventSpotSchema,
      OrderSchema,
      SpotReservationSchema,
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
  const domainEventManager = new DomainEventManager();
  const applicationService = new ApplicationService(uow, domainEventManager);
  const customerRepo = new CustomerMysqlRepository(em);
  const partnerRepo = new PartnerMysqlRepository(em);
  const eventRepo = new EventMysqlRepository(em);
  const orderRepo = new OrderMysqlRepository(em);
  const spotReservationRepo = new SpotReservationMysqlRepository(em);
  const waitingListRepo = new WaitingListMysqlRepository(em);

  const orderCancelledHandler = new OrderCancelledHandler(
    eventRepo,
    spotReservationRepo,
    domainEventManager,
  );
  OrderCancelledHandler.listensTo().forEach((eventName) => {
    domainEventManager.register(eventName, (event) =>
      orderCancelledHandler.handle(event),
    );
  });
  const eventSpotReleasedHandler = new EventSpotReleasedHandler(
    waitingListRepo,
    domainEventManager,
  );
  EventSpotReleasedHandler.listensTo().forEach((eventName) => {
    domainEventManager.register(eventName, (event) =>
      eventSpotReleasedHandler.handle(event),
    );
  });

  const orderService = new OrderService(
    orderRepo,
    customerRepo,
    eventRepo,
    spotReservationRepo,
    uow,
    new PaymentGateway(),
    applicationService,
  );
  const waitingListService = new WaitingListService(
    waitingListRepo,
    customerRepo,
    eventRepo,
    applicationService,
  );

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
  const order = await orderService.create({
    event_id: event.id.value,
    section_id: section.id.value,
    spot_id: spot.id.value,
    customer_id: customerA.id.value,
    card_token: 'tok_visa',
  });
  await waitingListService.join({
    event_id: event.id.value,
    section_id: section.id.value,
    customer_id: customerB.id.value,
  });
  await em.clear();

  await orderService.cancel(order.id.value);
  await em.clear();

  const eventFound = await eventRepo.findById(event.id);
  const spotFound = [...[...eventFound.sections][0].spots].find((item) =>
    item.id.equals(spot.id),
  );
  expect(spotFound.is_reserved).toBe(false);
  expect(await spotReservationRepo.findById(spot.id)).toBeNull();

  const waitingList = await waitingListRepo.findByEventAndSection(
    event.id,
    section.id,
  );
  const [first] = [...waitingList.entries];
  expect(first.customer_id.equals(customerB.id)).toBe(true);
  expect(first.status).toBe(WaitingListEntryStatus.NOTIFIED);

  await orm.close();
});
