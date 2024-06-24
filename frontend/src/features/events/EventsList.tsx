// src/features/events/EventsList.tsx
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchEventsThunk } from './eventsSlice';
import { Event } from './eventTypes';

const EventsList: React.FC = () => {
  const dispatch = useAppDispatch();
  const entireState = useAppSelector(state => state); // Moved outside useEffect
  const events = useAppSelector((state) => state.events.events);
  const status = useAppSelector((state) => state.events.status);

  // Logging the entire state once on component mount
  useEffect(() => {
    console.log("Redux State on Mount:", entireState);
  }, [entireState]); // Correctly depend on entireState to avoid stale closure issues

  // Fetch events when the component mounts and the status is 'idle'
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
