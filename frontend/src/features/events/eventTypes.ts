// src/features/events/eventTypes.ts
export interface Owner {
  id: number;
  username: string;
}

export interface Event {
  id: number;
  owner: Owner;
  platform: null | string;
  event_type: string;
  is_recurrent: boolean;
  image: null | string;
  title: string;
  description: string;
  other_platform: string;
  reference_price: number;
  date_created: string;
  date_start: string;
  date_end: string;
  date_recorded: null | string;
  schedule_description: string;
  deleted: boolean;
}

export interface EventsState {
  events: Event[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
