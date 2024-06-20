// src/features/events/EventsList.tsx
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks'; // Make sure to define these hooks for type safety
import { fetchEventsThunk } from './eventsSlice';
import { Event } from './eventTypes';

const EventsList: React.FC = () => {
  const dispatch = useAppDispatch();
  const events = useAppSelector((state) => state.events.events);
  const status = useAppSelector((state) => state.events.status);

  useEffect(() => {
    console.log("EventsList is mounted");
    if (status === 'idle') {
      dispatch(fetchEventsThunk());
    }
  }, [status, dispatch]);

  return (
    <div>
      <h1>Events</h1>
      {status === 'loading' && <p>Loading...</p>}
      {status === 'succeeded' && (
        <ul>
          {events.map((event: Event) => (
            <li key={event.id}>{event.title}</li>
          ))}
        </ul>
      )}
      {status === 'failed' && <p>Error loading events.</p>}
    </div>
  );
};

export default EventsList;
