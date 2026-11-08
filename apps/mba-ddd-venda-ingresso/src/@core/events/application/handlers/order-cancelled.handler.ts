import { IDomainEventHandler } from '../../../common/application/domain-event-handler.interface';
import { DomainEventManager } from '../../../common/domain/domain-event-manager';
import { OrderCancelled } from '../../domain/events/domain-events/order-cancelled.event';
import { IEventRepository } from '../../domain/repositories/event-repository.interface';
import { ISpotReservationRepository } from '../../domain/repositories/spot-reservation-repository.interface';

export class OrderCancelledHandler implements IDomainEventHandler {
  constructor(
    private eventRepo: IEventRepository,
    private spotReservationRepo: ISpotReservationRepository,
    private domainEventManager: DomainEventManager,
  ) {}

  async handle(event: OrderCancelled): Promise<void> {
    const aggregate = await this.eventRepo.findByEventSpotId(
      event.event_spot_id,
    );
    aggregate.markSpotAsAvailable(event.event_spot_id);
    await this.eventRepo.add(aggregate);
    const reservation = await this.spotReservationRepo.findById(
      event.event_spot_id,
    );
    if (reservation) {
      await this.spotReservationRepo.delete(reservation);
    }
    await this.domainEventManager.publish(aggregate);
  }

  static listensTo(): string[] {
    return [OrderCancelled.name];
  }
}
