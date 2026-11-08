import { MikroORM, MySqlDriver } from '@mikro-orm/mysql';
import { ApplicationService } from '../../common/application/application.service';
import { DomainEventManager } from '../../common/domain/domain-event-manager';
import { UnitOfWorkMikroOrm } from '../../common/infra/unit-of-work-mikro-orm';
import { Customer } from '../domain/entities/customer.entity';
import { Partner } from '../domain/entities/partner.entity';
import { EventSectionId } from '../domain/entities/event-section';
import { Order, OrderStatus } from '../domain/entities/order.entity';
import { OrderId } from '../domain/entities/order.entity';
import { OrderCancelled } from '../domain/events/domain-events/order-cancelled.event';
import {
  CustomerSchema,
  EventSchema,
  EventSectionSchema,
  EventSpotSchema,
  OrderSchema,
  PartnerSchema,
  SpotReservationSchema,
} from '../infra/db/schemas';
import { CustomerMysqlRepository } from '../infra/db/repositories/customer-mysql.repository';
import { EventMysqlRepository } from '../infra/db/repositories/event-mysql.repository';
import { OrderMysqlRepository } from '../infra/db/repositories/order-mysql.repository';
import { PartnerMysqlRepository } from '../infra/db/repositories/partner-mysql.repository';
import { SpotReservationMysqlRepository } from '../infra/db/repositories/spot-reservation-mysql.repository';
import { OrderService } from './order.service';
import { PaymentGateway } from './payment.gateway';

test('cancela o pedido e registra OrderCancelled', async () => {
  const orm = await MikroORM.init<MySqlDriver>({
    entities: [
      CustomerSchema,
      PartnerSchema,
      EventSchema,
      EventSectionSchema,
      EventSpotSchema,
      OrderSchema,
      SpotReservationSchema,
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
  const orderRepo = new OrderMysqlRepository(em);
  const spotReservationRepo = new SpotReservationMysqlRepository(em);
  const orderService = new OrderService(
    orderRepo,
    customerRepo,
    eventRepo,
    spotReservationRepo,
    uow,
    new PaymentGateway(),
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
  await eventRepo.add(event);
  const spot = [...[...event.sections][0].spots][0];
  const order = Order.create({
    customer_id: customer.id,
    amount: 100,
    event_spot_id: spot.id,
  });
  await orderRepo.add(order);
  await uow.commit();
  await em.clear();

  await expect(orderService.cancel(new OrderId().value)).rejects.toThrow(
    'Order not found',
  );

  const cancelled = await orderService.cancel(order.id.value);
  expect(cancelled.status).toBe(OrderStatus.CANCELLED);
  expect(cancelled.toJSON().status).toBe('CANCELLED');
  const orderCancelled = [...cancelled.events].find(
    (domainEvent) => domainEvent instanceof OrderCancelled,
  ) as OrderCancelled;
  expect(orderCancelled.event_spot_id.equals(spot.id)).toBe(true);

  await expect(orderService.cancel(order.id.value)).rejects.toThrow(
    'Order already cancelled',
  );

  await orm.close();
});
