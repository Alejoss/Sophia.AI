import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { apiRegister } from '../api/profilesApi';
import '../styles/Register.css';
import SocialLogin from '../components/SocialLogin';

const Register = () => {
  const navigate = useNavigate();
  const { updateAuthState } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({}); // Track which fields have been touched

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('Debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Debe contener al menos una letra mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Debe contener al menos una letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Debe contener al menos un número');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) {
      errors.push('Debe contener al menos un carácter especial (!@#$%^&*...)');
    }
    return errors;
  };

  // Translate common Django REST Framework error messages from English to Spanish
  const translateErrorMessage = (message) => {
    const translations = {
      'This field may not be blank.': 'Este campo es requerido.',
      'This field is required.': 'Este campo es requerido.',
      'This field cannot be blank.': 'Este campo es requerido.',
      'Enter a valid email address.': 'Por favor, ingresa un correo electrónico válido.',
      'A user with that username already exists.': 'Ya existe un usuario con ese nombre de usuario.',
      'A user with this email already exists.': 'Ya existe un usuario con ese correo electrónico.',
      'user with this username already exists.': 'Ya existe un usuario con ese nombre de usuario.',
      'user with this email already exists.': 'Ya existe un usuario con ese correo electrónico.',
    };

    // Check if message is in translations
    if (translations[message]) {
      return translations[message];
    }

    // Check if message starts with any of the keys (for partial matches)
    for (const [key, value] of Object.entries(translations)) {
      if (message.includes(key)) {
        return value;
      }
    }

    return message;
  };

  const validateEmail = (email) => {
    if (!email.trim()) {
      return 'El correo electrónico es requerido.';
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return 'Por favor, ingresa un correo electrónico válido (ejemplo: usuario@dominio.com).';
    }
    return null;
  };

  const validateUsername = (username) => {
    if (!username.trim()) {
      return 'El nombre de usuario es requerido.';
    }
    if (username.trim().length < 3) {
      return 'El nombre de usuario debe tener al menos 3 caracteres.';
    }
    // Explicitly check for @ symbol
    if (username.includes('@')) {
      return 'El nombre de usuario no puede contener el símbolo @. Usa solo letras, números y guiones bajos (_).';
    }
    // Check for invalid characters
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return 'El nombre de usuario solo puede contener letras, números y guiones bajos (_).';
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Prevent @ symbol in username field
    if (name === 'username' && value.includes('@')) {
      return; // Don't update the value if it contains @
    }
    
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prevErrors) => {
        const newErrors = { ...prevErrors };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Clear server error when user modifies any field
    if (serverError) {
      setServerError('');
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prevTouched) => ({ ...prevTouched, [name]: true }));

    // Validate on blur
    let fieldError = null;

    if (name === 'username') {
      fieldError = validateUsername(value);
    } else if (name === 'email') {
      fieldError = validateEmail(value);
    } else if (name === 'password') {
      const passwordErrors = validatePassword(value);
      if (passwordErrors.length > 0) {
        fieldError = passwordErrors;
      }
    } else if (name === 'confirmPassword') {
      if (value && value !== formData.password) {
        fieldError = 'Las contraseñas no coinciden.';
      }
    }

    if (fieldError) {
      setErrors((prevErrors) => ({ ...prevErrors, [name]: fieldError }));
    } else {
      setErrors((prevErrors) => {
        const newErrors = { ...prevErrors };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    // Mark all fields as touched
    setTouched({
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    // Validate all fields
    const newErrors = {};

    const usernameError = validateUsername(formData.username);
    if (usernameError) {
      newErrors.username = usernameError;
    }

    const emailError = validateEmail(formData.email);
    if (emailError) {
      newErrors.email = emailError;
    }

    const passwordErrors = validatePassword(formData.password);
    if (passwordErrors.length > 0) {
      newErrors.password = passwordErrors;
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Por favor, confirma tu contraseña.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden. Por favor, verifica que ambas contraseñas sean iguales.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to first error
      const firstErrorField = Object.keys(newErrors)[0];
      const errorElement = document.getElementById(firstErrorField);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errorElement.focus();
      }
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const { confirmPassword, ...registrationData } = formData;
      const response = await apiRegister(registrationData);
      console.log("Register API response:", response);

      if (response.data) {
        const { access_token, ...userData } = response.data;
        // Use centralized auth state update
        updateAuthState(userData, access_token);
        navigate("/profiles/login_successful");
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'object' && error.response.data !== null) {
          const backendErrors = {};
          for (const key in error.response.data) {
            if (Array.isArray(error.response.data[key])) {
              // Translate each error message and join them
              const translatedErrors = error.response.data[key].map(translateErrorMessage);
              const errorMessage = translatedErrors.join('. ');
              backendErrors[key] = errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1);
            } else if (typeof error.response.data[key] === 'string') {
              // Translate and capitalize first letter of string errors
              const errorMessage = translateErrorMessage(error.response.data[key]);
              backendErrors[key] = errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1);
            } else {
              // For non-field errors like 'detail' or general 'error' from backend
              if (key === 'detail' || key === 'error') {
                const errorMsg = typeof error.response.data[key] === 'string' 
                  ? translateErrorMessage(error.response.data[key])
                  : JSON.stringify(error.response.data[key]);
                setServerError(errorMsg.charAt(0).toUpperCase() + errorMsg.slice(1));
                continue;
              }
              backendErrors[key] = translateErrorMessage(String(error.response.data[key]));
            }
          }
          if (Object.keys(backendErrors).length > 0) {
            setErrors(prevErrors => ({...prevErrors, ...backendErrors}));
          }
        } else {
          // Handle cases where error.response.data is a string
          const errorMsg = translateErrorMessage(error.response.data.toString());
          setServerError(errorMsg.charAt(0).toUpperCase() + errorMsg.slice(1));
        }
      } else if (error.request) {
        setServerError('No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet e intenta nuevamente.');
      } else {
        setServerError('Ocurrió un error inesperado durante el registro. Por favor, intenta nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-container">
      <form onSubmit={handleSubmit} className="register-form">
        <h2>Crear cuenta</h2>
        {serverError && (
          <div className="server-error-message" role="alert">
            <strong>Error:</strong> {serverError}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="username">Nombre de usuario</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              // Prevent @ symbol from being typed in username field
              if (e.key === '@') {
                e.preventDefault();
              }
            }}
            className={errors.username ? 'input-error' : ''}
            aria-invalid={errors.username ? "true" : "false"}
            aria-describedby={errors.username ? "username-error" : null}
          />
          {errors.username && (
            <div id="username-error" className="error-message" role="alert">
              {errors.username}
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Correo electrónico</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.email ? 'input-error' : ''}
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "email-error" : null}
          />
          {errors.email && (
            <div id="email-error" className="error-message" role="alert">
              {errors.email}
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.password ? 'input-error' : ''}
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? "password-error" : null}
          />
          {errors.password && (
            <div id="password-error" className="error-message" role="alert">
              {Array.isArray(errors.password) ? (
                <ul className="error-list">
                  {errors.password.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              ) : (
                errors.password
              )}
            </div>
          )}
          {!errors.password && touched.password && formData.password && validatePassword(formData.password).length === 0 && (
            <div className="help-text success-text">
              ✓ La contraseña cumple con todos los requisitos de seguridad.
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmar contraseña</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            className={errors.confirmPassword ? 'input-error' : ''}
            aria-invalid={errors.confirmPassword ? "true" : "false"}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : null}
          />
          {errors.confirmPassword && (
            <div id="confirmPassword-error" className="error-message" role="alert">
              {errors.confirmPassword}
            </div>
          )}
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
