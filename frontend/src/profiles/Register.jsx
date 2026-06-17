import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { apiRegister } from '../api/profilesApi';
import SocialLogin from '../components/SocialLogin';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    <Container maxWidth="sm" sx={{ py: { xs: 2, md: 4 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          Crear cuenta
        </Typography>

        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {serverError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              id="username"
              name="username"
              label="Nombre de usuario"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === '@') {
                  e.preventDefault();
                }
              }}
              error={Boolean(errors.username)}
              helperText={errors.username || ''}
              fullWidth
            />

            <TextField
              id="email"
              name="email"
              label="Correo electrónico"
              type="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.email)}
              helperText={errors.email || ''}
              fullWidth
            />

            <TextField
              id="password"
              name="password"
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.password)}
              helperText={
                Array.isArray(errors.password) ? (
                  <Box component="span">
                    {errors.password.map((err, index) => (
                      <Box key={index} component="span" sx={{ display: 'block' }}>
                        {err}
                      </Box>
                    ))}
                  </Box>
                ) : (
                  errors.password || ''
                )
              }
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {!errors.password &&
              touched.password &&
              formData.password &&
              validatePassword(formData.password).length === 0 && (
                <Alert severity="success">
                  La contrasena cumple con todos los requisitos de seguridad.
                </Alert>
              )}

            <TextField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirmar contraseña"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword || ''}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirmPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }}>O continúa con</Divider>
        <SocialLogin />
      </Paper>
    </Container>
  );
};

export default Register;
