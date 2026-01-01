import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRegister } from '../api/profilesApi'; // This will be created next
import '../styles/Register.css'; // Import the new CSS file
import SocialLogin from '../components/SocialLogin';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // For disabling button

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('La contraseña debe tener al menos 8 caracteres.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra mayúscula.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra minúscula.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('La contraseña debe contener al menos un número.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) {
      errors.push('La contraseña debe contener al menos un carácter especial.');
    }
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'El nombre de usuario es requerido.';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es requerido.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El correo electrónico es inválido.';
    }

    const passwordErrors = validatePassword(formData.password);
    if (passwordErrors.length > 0) {
      newErrors.password = passwordErrors.join(' ');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const { confirmPassword, ...registrationData } = formData;
      const userData = await apiRegister(registrationData);
      navigate('/welcome', { state: { user: userData } });
    } catch (error) {
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'object' && error.response.data !== null) {
            const backendErrors = {};
            for (const key in error.response.data) {
                if (Array.isArray(error.response.data[key])) {
                    backendErrors[key] = error.response.data[key].join(' ');
                } else {
                    // For non-field errors like 'detail' or general 'error' from backend
                    if (key === 'detail' || key === 'error') {
                        setServerError(error.response.data[key]);
                        continue;
                    }
                    backendErrors[key] = error.response.data[key];
                }
            }
            setErrors(prevErrors => ({...prevErrors, ...backendErrors}));
        } else {
             // Handle cases where error.response.data is a string (e.g. simple text response)
             setServerError(error.response.data.toString());
        }
      } else {
        setServerError('Error en el registro. Ocurrió un error inesperado.');
      }
      console.error('Registration error:', error);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="register-container">
      <form onSubmit={handleSubmit} className="register-form">
        <h2>Crear cuenta</h2>
        {serverError && <div className="server-error-message">{serverError}</div>}
        
        <div className="form-group">
          <label htmlFor="username">Nombre de usuario</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            aria-invalid={errors.username ? "true" : "false"}
            aria-describedby={errors.username ? "username-error" : null}
          />
          {errors.username && <div id="username-error" className="error-message">{errors.username}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Correo electrónico</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "email-error" : null}
          />
          {errors.email && <div id="email-error" className="error-message">{errors.email}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? "password-error" : null}
          />
          {errors.password && <div id="password-error" className="error-message">{errors.password}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmar contraseña</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            aria-invalid={errors.confirmPassword ? "true" : "false"}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : null}
          />
          {errors.confirmPassword && <div id="confirmPassword-error" className="error-message">{errors.confirmPassword}</div>}
        </div>
        
        <button type="submit" className="submit-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <div className="social-login-section">
        <p>O continúa con</p>
        <SocialLogin />
      </div>
    </div>
  );
};

export default Register;
