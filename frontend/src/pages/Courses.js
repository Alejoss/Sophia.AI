import React, { useState, useEffect } from 'react';

function Courses() {
    const [events, setEvents] = useState([]);  // State to store the list of events

    useEffect(() => {
        // Fetch events from your API on component mount
        fetch('http://localhost:8000/api/events/')
            .then(response => response.json())
            .then(data => setEvents(data))
            .catch(error => console.error('Error fetching events:', error));
    }, []);  // The empty array as a second argument ensures the effect only runs once after the initial render

    return (
        <div>
            <h1>Events</h1>
            <ul>
                {events.map(event => (
                    <li key={event.id}>
                        {event.title} - Hosted by {event.owner.username}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Courses;
