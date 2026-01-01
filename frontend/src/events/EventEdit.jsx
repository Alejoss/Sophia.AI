import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchEventById, updateEvent } from '../api/eventsApi';
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
  { value: 'LIVE_COURSE', label: 'Curso en Vivo' },
  { value: 'LIVE_CERTIFICATION', label: 'Certificación en Vivo' },
  { value: 'LIVE_MASTER_CLASS', label: 'Clase Magistral en Vivo' },
];

const EventEdit = () => {
  const { eventId } = useParams();
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
  const [currentImage, setCurrentImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setFetchLoading(true);
        const eventData = await fetchEventById(eventId);
        
        // Format dates for datetime-local inputs
        const formatDateForInput = (dateString) => {
          if (!dateString) return '';
          const date = new Date(dateString);
          return date.toISOString().slice(0, 16);
        };

        setForm({
          title: eventData.title || '',
          description: eventData.description || '',
          event_type: eventData.event_type || '',
          platform: eventData.platform || '',
          other_platform: eventData.other_platform || '',
          reference_price: eventData.reference_price ? eventData.reference_price.toString() : '',
          date_start: formatDateForInput(eventData.date_start),
          date_end: formatDateForInput(eventData.date_end),
          schedule_description: eventData.schedule_description || '',
        });

        if (eventData.image) {
          setCurrentImage(eventData.image);
          setImagePreview(eventData.image);
        }
      } catch (err) {
        console.error('Error loading event:', err);
        setError('Error al cargar el evento. Por favor, inténtelo de nuevo.');
      } finally {
        setFetchLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const validateForm = () => {
    const newErrors = {};

    if (!form.title.trim()) {
      newErrors.title = 'El título es obligatorio';
    }

    if (!form.description.trim()) {
      newErrors.description = 'La descripción es obligatoria';
    }

    if (!form.event_type) {
      newErrors.event_type = 'El tipo de evento es obligatorio';
    }

    if (!form.platform) {
      newErrors.platform = 'La plataforma es obligatoria';
    }

    if (form.platform === 'other' && !form.other_platform.trim()) {
      newErrors.other_platform = 'El nombre de la otra plataforma es obligatorio';
    }

    if (form.date_start && form.date_end) {
      const startDate = new Date(form.date_start);
      const endDate = new Date(form.date_end);
      if (endDate <= startDate) {
        newErrors.date_end = 'La fecha de fin debe ser posterior a la fecha de inicio';
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
        setErrors(prev => ({ ...prev, image: 'Por favor, seleccione un archivo de imagen válido' }));
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, image: 'El tamaño de la imagen debe ser menor a 5MB' }));
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
    setCurrentImage(null);
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
      
      // Add image if a new one was selected
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      const updatedEvent = await updateEvent(eventId, formData);
      setSuccess('¡Evento actualizado exitosamente!');
      
      // Navigate to the updated event after a short delay
      setTimeout(() => {
        navigate(`/events/${updatedEvent.id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error updating event:', err);
      
      if (err.other_platform) {
        setErrors({ other_platform: err.other_platform });
      } else if (err.date_end) {
        setErrors({ date_end: err.date_end });
      } else if (err.detail) {
        setError(err.detail);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Error al actualizar el evento. Por favor, inténtelo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="event-create-container">
        <div className="text-center">
          <h2>Editar Evento</h2>
          <div className="loading-spinner">Cargando evento...</div>
        </div>
      </div>
    );
  }

  if (error && !form.title) {
    return (
      <div className="event-create-container">
        <div className="text-center">
          <h2>Editar Evento</h2>
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/events')} className="btn btn-primary">
            Volver a Eventos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="event-create-container">
      <h2>Editar Evento</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Título: *</label>
          <input 
            name="title" 
            value={form.title} 
            onChange={handleChange} 
            className={errors.title ? 'error' : ''}
            placeholder="Ingrese el título del evento"
          />
          {errors.title && <span className="error-message">{errors.title}</span>}
        </div>
        
        <div className="form-group">
          <label>Descripción: *</label>
          <textarea 
            name="description" 
            value={form.description} 
            onChange={handleChange}
            className={errors.description ? 'error' : ''}
            placeholder="Describa su evento..."
          />
          {errors.description && <span className="error-message">{errors.description}</span>}
        </div>
        
        <div className="form-group">
          <label>Imagen del Evento:</label>
          <div className="image-upload-container">
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageChange}
              className="image-input"
              id="event-image"
            />
            <label htmlFor="event-image" className="image-upload-label">
              {imagePreview ? 'Cambiar Imagen' : 'Elegir Imagen'}
            </label>
            {imagePreview && (
              <div className="image-preview-container">
                <img src={imagePreview} alt="Preview" className="image-preview" />
                <button type="button" onClick={removeImage} className="remove-image-btn">
                  Eliminar
                </button>
              </div>
            )}
          </div>
          {errors.image && <span className="error-message">{errors.image}</span>}
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Tipo de Evento: *</label>
            <select 
              name="event_type" 
              value={form.event_type} 
              onChange={handleChange}
              className={errors.event_type ? 'error' : ''}
            >
              <option value="">Seleccionar tipo</option>
              {EVENT_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
            {errors.event_type && <span className="error-message">{errors.event_type}</span>}
          </div>
          
          <div className="form-group">
            <label>Plataforma: *</label>
            <select 
              name="platform" 
              value={form.platform} 
              onChange={handleChange}
              className={errors.platform ? 'error' : ''}
            >
              <option value="">Seleccionar plataforma</option>
              {PLATFORM_CHOICES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {errors.platform && <span className="error-message">{errors.platform}</span>}
          </div>
        </div>
        
        {form.platform === 'other' && (
          <div className="form-group">
            <label>Otra Plataforma: *</label>
            <input 
              name="other_platform" 
              value={form.other_platform} 
              onChange={handleChange}
              className={errors.other_platform ? 'error' : ''}
              placeholder="Ingrese el nombre de la plataforma"
            />
            {errors.other_platform && <span className="error-message">{errors.other_platform}</span>}
          </div>
        )}
        
        <div className="form-group">
          <label>Precio de Referencia (USD):</label>
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
            <label>Fecha/Hora de Inicio:</label>
            <input 
              name="date_start" 
              type="datetime-local" 
              value={form.date_start} 
              onChange={handleChange} 
            />
          </div>
          
          <div className="form-group">
            <label>Fecha/Hora de Fin:</label>
            <input 
              name="date_end" 
              type="datetime-local" 
              value={form.date_end} 
              onChange={handleChange}
              className={errors.date_end ? 'error' : ''}
            />
            {errors.date_end && <span className="error-message">{errors.date_end}</span>}
          </div>
        </div>
        
        <div className="form-group">
          <label>Descripción del Horario:</label>
          <textarea 
            name="schedule_description" 
            value={form.schedule_description} 
            onChange={handleChange}
            placeholder="ej., Todos los martes durante 5 semanas"
            rows="3"
          />
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={() => navigate(`/events/${eventId}`)} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar Evento'}
          </button>
        </div>
      </form>
      
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default EventEdit; 