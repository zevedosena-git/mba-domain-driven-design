import { AggregateRoot } from '../../../common/domain/aggregate-root';
import {
  AnyCollection,
  ICollection,
  MyCollectionFactory,
} from '../../../common/domain/my-collection';
import Uuid from '../../../common/domain/value-objects/uuid.vo';
import { CustomerJoinedWaitingList } from '../events/domain-events/customer-joined-waiting-list.event';
import { SpotOfferedToWaitingCustomer } from '../events/domain-events/spot-offered-to-waiting-customer.event';
import { CustomerId } from './customer.entity';
import { EventSectionId } from './event-section';
import { EventSpotId } from './event-spot';
import { EventId } from './event.entity';
import { WaitingListEntry, WaitingListEntryStatus } from './waiting-list-entry';

export class WaitingListId extends Uuid {}

export type WaitingListConstructorProps = {
  id?: WaitingListId | string;
  event_id: EventId | string;
  section_id: EventSectionId | string;
};

export class WaitingList extends AggregateRoot {
  id: WaitingListId;
  event_id: EventId;
  section_id: EventSectionId;
  private _entries: ICollection<WaitingListEntry>;

  constructor(props: WaitingListConstructorProps) {
    super();
    this.id =
      typeof props.id === 'string'
        ? new WaitingListId(props.id)
        : props.id ?? new WaitingListId();
    this.event_id =
      props.event_id instanceof EventId
        ? props.event_id
        : new EventId(props.event_id);
    this.section_id =
      props.section_id instanceof EventSectionId
        ? props.section_id
        : new EventSectionId(props.section_id);
    this._entries = MyCollectionFactory.create<WaitingListEntry>(this);
  }

  static create(props: {
    event_id: EventId | string;
    section_id: EventSectionId | string;
  }) {
    return new WaitingList(props);
  }

  join(customer_id: CustomerId) {
    const pending = this.entries.find(
      (entry) =>
        entry.customer_id.equals(customer_id) &&
        entry.status === WaitingListEntryStatus.PENDING,
    );
    if (pending) {
      throw new Error('Customer already in waiting list');
    }

    const entry = WaitingListEntry.create({
      customer_id,
      position: this.entries.size + 1,
    });
    this.entries.add(entry);
    this.addEvent(new CustomerJoinedWaitingList(this.id, customer_id));
    return entry;
  }

  offerSpot(spot_id: EventSpotId) {
    let selected: WaitingListEntry | undefined;
    this.entries.forEach((entry) => {
      if (entry.status !== WaitingListEntryStatus.PENDING) {
        return;
      }
      if (!selected || entry.position < selected.position) {
        selected = entry;
      }
    });
    if (!selected) {
      return;
    }

    selected.markAsNotified();
    this.addEvent(
      new SpotOfferedToWaitingCustomer(
        this.id,
        selected.customer_id,
        this.event_id,
        this.section_id,
        spot_id,
      ),
    );
  }

  get entries(): ICollection<WaitingListEntry> {
    return this._entries as ICollection<WaitingListEntry>;
  }

  set entries(entries: AnyCollection<WaitingListEntry>) {
    this._entries = MyCollectionFactory.createFrom<WaitingListEntry>(entries);
  }

  toJSON() {
    return {
      id: this.id.value,
      event_id: this.event_id.value,
      section_id: this.section_id.value,
      entries: [...this._entries].map((entry) => entry.toJSON()),
    };
  }
}
