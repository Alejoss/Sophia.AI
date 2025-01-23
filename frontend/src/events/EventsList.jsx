// src/features/events/EventsList.tsx
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks.js';
import { fetchEventsThunk } from './eventsSlice.js';
import { Event } from './eventTypes.js';
import { Link } from 'react-router-dom';

const EventsList: React.FC = () => {
  const dispatch = useAppDispatch();
  const events = useAppSelector((state) => state.events.events);
  const status = useAppSelector((state) => state.events.status);

  // Fetch events when the component mounts and the status is 'idle'
  useEffect(() => {
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
              <li key={event.id}>
                <Link to={`/events/${event.id}`}>{event.title}</Link> {/* Link to the detail page */}
              </li>
          ))}
        </ul>
      )}
      {status === 'failed' && <p>Error loading events.</p>}
    </div>
  );
};

export default EventsList;
