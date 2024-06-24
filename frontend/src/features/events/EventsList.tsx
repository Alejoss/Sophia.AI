// src/features/events/EventsList.tsx
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks'; // Import both hooks once
import { fetchEventsThunk } from './eventsSlice';
import { Event } from './eventTypes';

const EventsList: React.FC = () => {
  const dispatch = useAppDispatch();

  // Use useEffect to log the entire state once on component mount
  useEffect(() => {
    const entireState = useAppSelector(state => state);
    console.log("Redux State on Mount:", entireState);
  }, []); // Empty dependency array to run only once

  const events = useAppSelector((state) => state.events.events);
  const status = useAppSelector((state) => state.events.status);

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
