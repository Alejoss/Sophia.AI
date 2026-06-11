import { useCallback, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  AUTH_ERROR_STRATEGY,
  LOGIN_PATH,
  getErrorMessage,
  getErrorStatus,
  handleAuthError,
  isUnauthorizedError,
} from '../utils/authErrorHandler';

export { AUTH_ERROR_STRATEGY, LOGIN_PATH };

/**
 * React hook that wires {@link handleAuthError} to the router and {@link AuthContext}.
 *
 * @example Protected page — redirect to login when session expires
 * ```jsx
 * const { handleAuthError } = useAuthErrorHandler({
 *   strategy: AUTH_ERROR_STRATEGY.REDIRECT,
 * });
 *
 * try {
 *   await loadResource();
 * } catch (err) {
 *   if (handleAuthError(err).handled) return;
 *   setError(getErrorMessage(err));
 * }
 * ```
 *
 * @example Public page — optional authenticated fetch
 * ```jsx
 * const { handleAuthError } = useAuthErrorHandler();
 *
 * try {
 *   await getUserRegistrations();
 * } catch (err) {
 *   if (handleAuthError(err, { strategy: AUTH_ERROR_STRATEGY.IGNORE }).handled) return;
 * }
 * ```
 *
 * @example Inline action — show feedback without leaving the page
 * ```jsx
 * const { handleAuthError } = useAuthErrorHandler();
 *
 * try {
 *   await submitVote();
 * } catch (err) {
 *   const result = handleAuthError(err, {
 *     strategy: AUTH_ERROR_STRATEGY.MESSAGE,
 *     message: 'Por favor inicia sesión para votar',
 *     onUnauthorized: (msg) => setActionError(msg),
 *   });
 *   if (result.handled) return;
 *   setActionError(getErrorMessage(err));
 * }
 * ```
 *
 * @param {import('../utils/authErrorHandler').AuthErrorHandlerOptions} [defaultOptions]
 *   Options merged into every call (e.g. default `strategy`).
 */
export default function useAuthErrorHandler(defaultOptions = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearAuthState } = useContext(AuthContext);

  const handle = useCallback(
    (error, callOptions = {}) => {
      const merged = { ...defaultOptions, ...callOptions };

      const returnTo =
        merged.returnTo === undefined
          ? `${location.pathname}${location.search}`
          : merged.returnTo;

      return handleAuthError(error, {
        ...merged,
        returnTo,
        navigate,
        clearAuthState,
      });
    },
    [clearAuthState, defaultOptions, location.pathname, location.search, navigate],
  );

  return {
    handleAuthError: handle,
    isUnauthorizedError,
    getErrorStatus,
    getErrorMessage,
    AUTH_ERROR_STRATEGY,
    LOGIN_PATH,
  };
}
