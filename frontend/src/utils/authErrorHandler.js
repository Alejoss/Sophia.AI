/**
 * @module authErrorHandler
 *
 * Centralized utilities for detecting and handling HTTP 401 (unauthorized) errors.
 *
 * ## Why this exists
 *
 * The axios interceptor (`api/axiosConfig.js`) refreshes expired tokens but deliberately
 * does **not** redirect — each caller decides what 401 means in context:
 *
 * - A **protected page** should send the user to login (with a return URL).
 * - A **public page** may fetch optional authenticated data and should ignore 401.
 * - An **inline action** (vote, register) should show a message instead of navigating away.
 *
 * API modules historically threw `error.response.data`, which strips the HTTP status and
 * made `err.response?.status === 401` impossible in components. Use {@link rethrowAxiosError}
 * in API catch blocks so status survives as {@link ApiError}.
 *
 * ## Quick start (components)
 *
 * ```jsx
 * import useAuthErrorHandler, { AUTH_ERROR_STRATEGY } from '../hooks/useAuthErrorHandler';
 *
 * const { handleAuthError } = useAuthErrorHandler();
 *
 * try {
 *   await fetchSomething();
 * } catch (err) {
 *   const result = handleAuthError(err, { strategy: AUTH_ERROR_STRATEGY.REDIRECT });
 *   if (result.handled) return;
 *   setError('No se pudo cargar el recurso.');
 * }
 * ```
 *
 * ## Quick start (API modules)
 *
 * ```js
 * import { rethrowAxiosError } from '../utils/authErrorHandler';
 *
 * export const fetchItem = async (id) => {
 *   try {
 *     const response = await axiosInstance.get(`/items/${id}/`);
 *     return response.data;
 *   } catch (error) {
 *     rethrowAxiosError(error, 'Error al cargar el elemento');
 *   }
 * };
 * ```
 */

/** Default login route — keep in sync with `ProtectedRoute` and `App.jsx`. */
export const LOGIN_PATH = '/profiles/login';

/**
 * How a 401 should be handled. Pick the strategy that matches user intent on that screen.
 *
 * @readonly
 * @enum {string}
 */
export const AUTH_ERROR_STRATEGY = {
  /**
   * Navigate to {@link LOGIN_PATH} with `state.from` so login can return the user.
   * Use on protected pages when the session expired or credentials are missing.
   */
  REDIRECT: 'redirect',

  /**
   * Do not navigate; return a user-facing message for the caller to display.
   * Use for inline actions (vote, bookmark) or when showing an Alert is enough.
   */
  MESSAGE: 'message',

  /**
   * Treat 401 as expected — no navigation, no message.
   * Use for optional authenticated fetches on public pages (e.g. registration state).
   */
  IGNORE: 'ignore',

  /**
   * Clear local auth state without navigating.
   * Use when the UI should reflect "logged out" but stay on the current page.
   */
  CLEAR_SESSION: 'clear_session',
};

const DEFAULT_UNAUTHORIZED_MESSAGE =
  'Por favor, inicia sesión para continuar.';

/**
 * Error thrown by {@link rethrowAxiosError} that preserves HTTP status and response body.
 */
export class ApiError extends Error {
  /**
   * @param {string} message - User-facing or log message
   * @param {{ status?: number, data?: unknown, originalError?: unknown }} [meta]
   */
  constructor(message, { status, data, originalError } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.originalError = originalError;
  }

  /** @returns {boolean} */
  get isUnauthorized() {
    return this.status === 401;
  }
}

/**
 * Extract HTTP status from axios errors, {@link ApiError}, or legacy thrown response bodies.
 *
 * @param {unknown} error
 * @returns {number|undefined}
 */
export function getErrorStatus(error) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if (typeof error.status === 'number') {
    return error.status;
  }

  if (typeof error.response?.status === 'number') {
    return error.response.status;
  }

  return undefined;
}

/**
 * @param {unknown} error
 * @returns {boolean} `true` when the error represents HTTP 401 Unauthorized
 */
export function isUnauthorizedError(error) {
  return getErrorStatus(error) === 401;
}

/**
 * Build a user-facing message from any supported error shape.
 *
 * @param {unknown} error
 * @param {string} [fallback='Error en la solicitud']
 * @returns {string}
 */
export function getErrorMessage(error, fallback = 'Error en la solicitud') {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object') {
    const record = /** @type {Record<string, unknown>} */ (error);
    if (typeof record.detail === 'string') {
      return record.detail;
    }
    if (typeof record.error === 'string') {
      return record.error;
    }
    if (record.data && typeof record.data === 'object') {
      const data = /** @type {Record<string, unknown>} */ (record.data);
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      if (typeof data.error === 'string') {
        return data.error;
      }
    }
  }

  return fallback;
}

/**
 * Message tailored for 401 responses (falls back to {@link DEFAULT_UNAUTHORIZED_MESSAGE}).
 *
 * @param {unknown} [error]
 * @param {string} [fallback]
 * @returns {string}
 */
export function getUnauthorizedMessage(
  error,
  fallback = DEFAULT_UNAUTHORIZED_MESSAGE,
) {
  const message = getErrorMessage(error, fallback);
  const genericDetail =
    message === 'Authentication credentials were not provided.' ||
    message === 'Las credenciales de autenticación no se proveyeron.';

  return genericDetail ? fallback : message;
}

/**
 * Convert an axios error into {@link ApiError} without throwing.
 *
 * @param {unknown} error
 * @param {string} [fallbackMessage='Error en la solicitud']
 * @returns {ApiError}
 */
export function createApiErrorFromAxios(
  error,
  fallbackMessage = 'Error en la solicitud',
) {
  if (error instanceof ApiError) {
    return error;
  }

  const axiosError = /** @type {{ response?: { status?: number, data?: unknown }, message?: string }} */ (
    error
  );

  if (axiosError?.response) {
    const { status, data } = axiosError.response;
    return new ApiError(getErrorMessage(data, fallbackMessage), {
      status,
      data,
      originalError: error,
    });
  }

  return new ApiError(
    axiosError?.message || fallbackMessage,
    { originalError: error },
  );
}

/**
 * Re-throw an axios error as {@link ApiError} so components can call {@link isUnauthorizedError}.
 *
 * @param {unknown} error
 * @param {string} [fallbackMessage='Error en la solicitud']
 * @returns {never}
 */
export function rethrowAxiosError(
  error,
  fallbackMessage = 'Error en la solicitud',
) {
  throw createApiErrorFromAxios(error, fallbackMessage);
}

/**
 * @typedef {Object} AuthErrorHandlerOptions
 * @property {typeof AUTH_ERROR_STRATEGY[keyof typeof AUTH_ERROR_STRATEGY]} [strategy]
 * @property {string} [loginPath]
 * @property {string|false|null} [returnTo] - Pathname+search to restore after login.
 *   `null` uses the current location when `navigate` is provided by the hook.
 * @property {string} [message] - Override the displayed / returned message
 * @property {(path: string, options?: { replace?: boolean, state?: object }) => void} [navigate]
 * @property {() => void} [clearAuthState]
 * @property {(message: string) => void} [onUnauthorized] - Called for MESSAGE strategy
 */

/**
 * @typedef {Object} AuthErrorHandlerResult
 * @property {boolean} handled - `true` when the error was a 401 and a strategy ran
 * @property {string} [strategy]
 * @property {string} [message]
 * @property {boolean} [redirected]
 * @property {boolean} [ignored]
 */

/**
 * Core 401 handler (framework-agnostic). React components should prefer {@link useAuthErrorHandler}.
 *
 * @param {unknown} error
 * @param {AuthErrorHandlerOptions} [options]
 * @returns {AuthErrorHandlerResult}
 */
export function handleAuthError(error, options = {}) {
  if (!isUnauthorizedError(error)) {
    return { handled: false };
  }

  const {
    strategy = AUTH_ERROR_STRATEGY.MESSAGE,
    loginPath = LOGIN_PATH,
    returnTo = null,
    message = null,
    navigate = null,
    clearAuthState = null,
    onUnauthorized = null,
  } = options;

  const userMessage = message || getUnauthorizedMessage(error);

  switch (strategy) {
    case AUTH_ERROR_STRATEGY.IGNORE:
      return {
        handled: true,
        strategy,
        message: userMessage,
        ignored: true,
      };

    case AUTH_ERROR_STRATEGY.CLEAR_SESSION:
      clearAuthState?.();
      return { handled: true, strategy, message: userMessage };

    case AUTH_ERROR_STRATEGY.REDIRECT: {
      if (navigate) {
        const from =
          returnTo === false
            ? undefined
            : { pathname: returnTo || '/' };

        navigate(loginPath, {
          replace: true,
          state: from ? { from } : undefined,
        });
      }

      return {
        handled: true,
        strategy,
        message: userMessage,
        redirected: Boolean(navigate),
      };
    }

    case AUTH_ERROR_STRATEGY.MESSAGE:
    default:
      onUnauthorized?.(userMessage);
      return { handled: true, strategy, message: userMessage };
  }
}
