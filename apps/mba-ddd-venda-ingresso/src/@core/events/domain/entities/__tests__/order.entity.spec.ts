import { CustomerId } from '../customer.entity';
import { EventSpotId } from '../event-spot';
import { OrderCancelled } from '../../events/domain-events/order-cancelled.event';
import { Order, OrderStatus } from '../order.entity';

describe('Order cancel', () => {
  const createOrder = () => {
    const eventSpotId = new EventSpotId();
    const order = Order.create({
      customer_id: new CustomerId(),
      amount: 100,
      event_spot_id: eventSpotId,
    });
    return { order, eventSpotId };
  };

  test('pedido pendente cancelado registra event_spot_id e recusa o segundo cancelamento', () => {
    const { order, eventSpotId } = createOrder();

    order.cancel();

    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.toJSON().status).toBe('CANCELLED');
    const cancelled = [...order.events].find(
      (event) => event instanceof OrderCancelled,
    ) as OrderCancelled;
    expect(cancelled.aggregate_id.equals(order.id)).toBe(true);
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    expect(cancelled.event_spot_id.equals(eventSpotId)).toBe(true);

    expect(() => order.cancel()).toThrow('Order already cancelled');
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(
      [...order.events].filter((event) => event instanceof OrderCancelled),
    ).toHaveLength(1);
  });

  test('pedido pago cancelado registra event_spot_id', () => {
    const { order, eventSpotId } = createOrder();

    order.pay();
    order.cancel();

    expect(order.status).toBe(OrderStatus.CANCELLED);
    const cancelled = [...order.events].find(
      (event) => event instanceof OrderCancelled,
    ) as OrderCancelled;
    expect(cancelled.event_spot_id.equals(eventSpotId)).toBe(true);
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
  });
});
