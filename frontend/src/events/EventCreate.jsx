import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent } from '../api/eventsApi';
import '../styles/events.css';

const PLATFORM_CHOICES = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'jitsi', label: 'Jitsi' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'tox', label: 'Tox' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'other', label: 'Other' },
];

const EVENT_TYPES = [
  { value: 'LIVE_COURSE', label: 'Live Course' },
  { value: 'LIVE_CERTIFICATION', label: 'Live Certification' },
  { value: 'LIVE_MASTER_CLASS', label: 'Live Master Class' },
];

// Helper function to format datetime for input
const formatDateTimeForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper function to get current datetime in local format
const getCurrentDateTimeLocal = () => {
  const now = new Date();
  // Add 1 hour to current time to avoid immediate past
  now.setHours(now.getHours() + 1);
  return formatDateTimeForInput(now);
};

// Helper function to get tomorrow's date for minimum start date
const getTomorrowDateTimeLocal = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // Set to 9 AM tomorrow
  return formatDateTimeForInput(tomorrow);
};

const EventCreate = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: '',
    platform: '',
    other_platform: '',
    reference_price: '',
    date_start: '',
    date_end: '',
    schedule_description: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const validateForm = () => {
    const newErrors = {};

    if (!form.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!form.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!form.event_type) {
      newErrors.event_type = 'Event type is required';
    }

    if (!form.platform) {
      newErrors.platform = 'Platform is required';
    }

    if (form.platform === 'other' && !form.other_platform.trim()) {
      newErrors.other_platform = 'Other platform name is required';
    }

    // Validate datetime fields
    if (form.date_start && form.date_end) {
      const startDate = new Date(form.date_start);
      const endDate = new Date(form.date_end);
      if (endDate <= startDate) {
        newErrors.date_end = 'End date must be after start date';
      }
    }

    // Only validate start date if it's provided
    if (form.date_start) {
      const startDate = new Date(form.date_start);
      const now = new Date();
      // Allow events to start within the next hour (for immediate events)
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (startDate < oneHourFromNow) {
        newErrors.date_start = 'Start date should be at least 1 hour from now';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, image: 'Please select a valid image file' }));
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, image: 'Image size must be less than 5MB' }));
        return;
      }

      setImageFile(file);
      setErrors(prev => ({ ...prev, image: '' }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setErrors(prev => ({ ...prev, image: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      
      // Add form fields
      Object.keys(form).forEach(key => {
        if (key === 'reference_price') {
          formData.append(key, form[key] ? parseFloat(form[key]) : 0);
        } else {
          formData.append(key, form[key]);
        }
      });
      
      // Add image if selected
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      const createdEvent = await createEvent(formData);
      setSuccess('Event created successfully!');
      
      // Navigate to the created event after a short delay
      setTimeout(() => {
        navigate(`/events/${createdEvent.id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error creating event:', err);
      
      if (err.other_platform) {
        setErrors({ other_platform: err.other_platform });
      } else if (err.date_end) {
        setErrors({ date_end: err.date_end });
      } else if (err.detail) {
        setError(err.detail);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Failed to create event. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-create-container">
      <h2>Create New Event</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title: *</label>
          <input 
            name="title" 
            value={form.title} 
            onChange={handleChange} 
            className={errors.title ? 'error' : ''}
            placeholder="Enter event title"
          />
          {errors.title && <span className="error-message">{errors.title}</span>}
        </div>
        
        <div className="form-group">
          <label>Description: *</label>
          <textarea 
            name="description" 
            value={form.description} 
            onChange={handleChange}
            className={errors.description ? 'error' : ''}
            placeholder="Describe your event..."
          />
          {errors.description && <span className="error-message">{errors.description}</span>}
        </div>
        
        <div className="form-group">
          <label>Event Image:</label>
          <div className="image-upload-container">
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageChange}
              className="image-input"
              id="event-image"
            />
            <label htmlFor="event-image" className="image-upload-label">
              {imagePreview ? 'Change Image' : 'Choose Image'}
            </label>
            {imagePreview && (
              <div className="image-preview-container">
                <img src={imagePreview} alt="Preview" className="image-preview" />
                <button type="button" onClick={removeImage} className="remove-image-btn">
                  Remove
                </button>
              </div>
            )}
          </div>
          {errors.image && <span className="error-message">{errors.image}</span>}
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Event Type: *</label>
            <select 
              name="event_type" 
              value={form.event_type} 
              onChange={handleChange}
              className={errors.event_type ? 'error' : ''}
            >
              <option value="">Select type</option>
              {EVENT_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
            {errors.event_type && <span className="error-message">{errors.event_type}</span>}
          </div>
          
          <div className="form-group">
            <label>Platform: *</label>
            <select 
              name="platform" 
              value={form.platform} 
              onChange={handleChange}
              className={errors.platform ? 'error' : ''}
            >
              <option value="">Select platform</option>
              {PLATFORM_CHOICES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {errors.platform && <span className="error-message">{errors.platform}</span>}
          </div>
        </div>
        
        {form.platform === 'other' && (
          <div className="form-group">
            <label>Other Platform: *</label>
            <input 
              name="other_platform" 
              value={form.other_platform} 
              onChange={handleChange}
              className={errors.other_platform ? 'error' : ''}
              placeholder="Enter platform name"
            />
            {errors.other_platform && <span className="error-message">{errors.other_platform}</span>}
          </div>
        )}
        
        <div className="form-group">
          <label>Reference Price (USD):</label>
          <input 
            name="reference_price" 
            type="text" 
            value={form.reference_price} 
            onChange={handleChange}
            placeholder="0.00"
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Start Date/Time:</label>
            <input 
              name="date_start" 
              type="datetime-local" 
              value={form.date_start} 
              onChange={handleChange}
              step="900"
              className={errors.date_start ? 'error' : ''}
              placeholder="Select start date and time"
            />
            {errors.date_start && <span className="error-message">{errors.date_start}</span>}
            <small style={{ color: '#666', fontSize: '0.8rem' }}>
              Click the calendar icon to select date and time
            </small>
          </div>
          
          <div className="form-group">
            <label>End Date/Time:</label>
            <input 
              name="date_end" 
              type="datetime-local" 
              value={form.date_end} 
              onChange={handleChange}
              step="900"
              className={errors.date_end ? 'error' : ''}
              placeholder="Select end date and time"
            />
            {errors.date_end && <span className="error-message">{errors.date_end}</span>}
            <small style={{ color: '#666', fontSize: '0.8rem' }}>
              Click the calendar icon to select date and time
            </small>
          </div>
        </div>
        
        <div className="form-group">
          <label>Schedule Description:</label>
          <textarea 
            name="schedule_description" 
            value={form.schedule_description} 
            onChange={handleChange}
            placeholder="e.g., Every Tuesday for 5 weeks"
            rows="3"
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
      
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default EventCreate; 