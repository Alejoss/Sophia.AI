import { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { AuthContext } from "../context/AuthContext.jsx";
import { apiLogin, checkAuth, refreshToken, getUserProfile } from "../api/profilesApi.js";
import {
  getUserFromLocalStorage,
  setAuthenticationStatus,
  isAuthenticated,
  getAccessTokenFromLocalStorage,
  setAccessTokenInLocalStorage } from
"../context/localStorageUtils.js";
import SocialLogin from "../components/SocialLogin";
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { parseApiValidationErrors } from "../utils/apiFormErrors.js";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography } from
"@mui/material";

const loginSchema = yup.object({
  username: yup
    .string()
    .trim()
    .required("El usuario o correo es requerido."),
  password: yup
    .string()
    .required("La contraseña es requerida."),
});

/**
 * Regular Login Component
 * Handles traditional username/email and password login
 */
const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState, setAuthState, updateAuthState } = useContext(AuthContext);
  const [generalError, setGeneralError] = useState("");
  const [backendAuthStatus, setBackendAuthStatus] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [loginImage, setLoginImage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionUsername, setSessionUsername] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    // Select a random login cover image (1-10)
    const randomImageNumber = Math.floor(Math.random() * 10) + 1;
    setLoginImage(`/images/login_cover/login_cover${randomImageNumber}.jpg`);
    const storedUser = getUserFromLocalStorage();
    const localStorageAuth = isAuthenticated();

    // Check if the user is authenticated with the backend and sync with localStorage
    checkAuth().then((isBackendAuthenticated) => {
      setBackendAuthStatus(isBackendAuthenticated);


      if (isBackendAuthenticated && !authState.isAuthenticated) {
        // Backend says authenticated but context was cleared (e.g. after wrong redirect on refresh)
        // Restore session: get new token and user, then redirect away from login
        setIsRestoringSession(true);
        refreshToken().
        then((data) => {
          const access_token = data?.access_token;
          if (!access_token) {
            setIsRestoringSession(false);
            return;
          }
          setAccessTokenInLocalStorage(access_token);
          return getUserProfile().then((profile) => {
            if (!profile?.user) {
              setIsRestoringSession(false);
              return;
            }
            updateAuthState(profile.user, access_token);
            const from = location.state?.from?.pathname || "/profiles/my_profile";
            navigate(from, { replace: true });
          });
        }).
        catch(() => {
          setIsRestoringSession(false);
          // Restore failed (e.g. no refresh cookie); backendAuthStatus is still true so we show "Ya has iniciado sesión"
        });
      } else if (isBackendAuthenticated && !localStorageAuth && storedUser) {
        setAuthenticationStatus(true);
        setAuthState({
          isAuthenticated: true,
          user: storedUser
        });
      } else if (!isBackendAuthenticated && localStorageAuth) {

        setAuthenticationStatus(false);
        setAuthState({
          isAuthenticated: false,
          user: storedUser
        });
      }
    });

    if (storedUser?.username) {
      setSessionUsername(storedUser.username);
      setValue("username", storedUser.username);
    }
  }, [setAuthState, authState.isAuthenticated, updateAuthState, location.state?.from?.pathname, navigate, setValue]);

  const onSubmit = async ({ username, password }) => {
    setGeneralError("");

    try {
      // Check if user had previous session data before login using utilities
      const storedUser = getUserFromLocalStorage();
      const wasAuthenticated = isAuthenticated();
      const hadAccessToken = getAccessTokenFromLocalStorage() !== null;
      const hadPreviousSession = storedUser !== null || wasAuthenticated || hadAccessToken;

      const response = await apiLogin({ username, password });

      if (response.data?.access_token) {
        const { access_token, ...userData } = response.data;
        // Mark if this is a returning user
        if (hadPreviousSession) {
          sessionStorage.setItem('had_previous_session', 'true');
        }
        // Use centralized auth state update (access in storage; refresh cookie set by backend)
        updateAuthState(userData, access_token);
        navigate("/profiles/login_successful");
        return;
      }

      setGeneralError(
        "No se recibió un token de acceso. Inténtalo de nuevo o contacta soporte.",
      );
    } catch (error) {
      console.error("Login error:", error);
      const { generalError: parsed } = parseApiValidationErrors(
        error,
        "Error al iniciar sesión. Inténtalo de nuevo.",
      );
      setGeneralError(parsed || "Error al iniciar sesión. Inténtalo de nuevo.");
    }
  };

  // Restoring session after wrong redirect (e.g. refresh on protected route)
  if (isRestoringSession) {
    return (
      <Box sx={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={28} />
          <Typography>Restaurando sesión...</Typography>
        </Stack>
      </Box>);

  }

  // Already authenticated (backend says so); show message only when not restoring
  if (backendAuthStatus) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="info">
          Ya has iniciado sesión como {sessionUsername || "usuario"}, ¿deseas
          <MuiLink component={Link} to="/profiles/logout" underline="hover" sx={{ ml: 0.5 }}>
            cerrar sesión
          </MuiLink>
          ?
        </Alert>
      </Container>);

  }

  // Not authenticated: show login form
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          alignItems: "stretch",
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper"
        }}>
        
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            minHeight: 460,
            backgroundImage: `url(${loginImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }} />
        

        <Box sx={{ p: { xs: 3, md: 4 }, display: "flex", alignItems: "center" }}>
          <Paper elevation={0} sx={{ width: "100%" }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: "center" }}>
              Iniciar sesión
            </Typography>

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Stack spacing={2.5}>
                <TextField
                  label="Usuario o correo electrónico"
                  {...register("username")}
                  error={!!errors.username}
                  helperText={errors.username?.message}
                  fullWidth
                  autoComplete="username" />
                
                <TextField
                  label="Contraseña"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  fullWidth
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment:
                    <InputAdornment position="end">
                        <IconButton
                        edge="end"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                        
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>

                  }} />
                

                {generalError && <Alert severity="error">{generalError}</Alert>}

                <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                  {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
                </Button>
              </Stack>
            </Box>

            <Divider sx={{ my: 3 }}>O continúa con</Divider>
            <SocialLogin />

            <Typography variant="body2" sx={{ textAlign: "center", mt: 3 }}>
              ¿No tienes cuenta?{" "}
              <MuiLink component={Link} to="/profiles/register" underline="hover">
                Regístrate
              </MuiLink>
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Container>);

};

export default Login;
