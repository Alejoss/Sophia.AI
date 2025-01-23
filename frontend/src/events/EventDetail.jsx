// src/features/events/EventDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';  // Make sure Link is imported
import axiosInstance from '../api/axios_config.js';
import { Event } from './eventTypes.js';

const EventDetail: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchEventDetail = async () => {
      try {
        const response = await axiosInstance.get<Event>(`api/courses/events/${eventId}`);
        setEvent(response.data);
      } catch (error) {
        console.error('Failed to fetch event details:', error);
      }
    };

    fetchEventDetail();
  }, [eventId]);

  const handleBack = () => {
    navigate(-1);  // Navigate back to the previous page
  };

  if (!event) return <p>Loading...</p>;

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p>Event Type: {event.event_type}</p>
      <p>Is Recurrent: {event.is_recurrent ? 'Yes' : 'No'}</p>
      {event.image && <img src={event.image} alt="Event" />}
      <p>Platform: {event.platform || 'No specific platform'}</p>
      <p>Other Platform: {event.other_platform}</p>
      <p>Reference Price: ${event.reference_price}</p>
      <p>Date Created: {new Date(event.date_created).toLocaleDateString()}</p>
      <p>Start Date: {new Date(event.date_start).toLocaleDateString()}</p>
      <p>End Date: {new Date(event.date_end).toLocaleDateString()}</p>
      {event.date_recorded && <p>Date Recorded: {new Date(event.date_recorded).toLocaleDateString()}</p>}
      <p>Schedule Description: {event.schedule_description}</p>
      <p>Owner: <Link to={`/profiles/${event.owner.id}`}>{event.owner.username}</Link></p> {/* Link to owner detail */}
      <button onClick={handleBack}>Back to Events</button>
    </div>
  );
};

export default EventDetail;
