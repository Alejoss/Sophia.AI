// src/features/events/EventDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axios';  // Make sure the path is correct
import { Event } from './eventTypes';

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
        // Optionally handle the error in the UI
      }
    };

    fetchEventDetail();
  }, [eventId]);

    // Function to handle back navigation
  const handleBack = () => {
    navigate(-1);  // Navigates back to the previous page
  };



  if (!event) return <p>Loading...</p>;

  return (
      <div>
        <button onClick={handleBack}>Back to Events</button>
        <h1>{event.title}</h1>
        <p>{event.description}</p>
        {/* Display other event details as needed */}
      </div>
  );
};

export default EventDetail;
