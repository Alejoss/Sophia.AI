import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  AUTH_ERROR_STRATEGY,
  createApiErrorFromAxios,
  getErrorMessage,
  getErrorStatus,
  getUnauthorizedMessage,
  handleAuthError,
  isUnauthorizedError,
  LOGIN_PATH,
  rethrowAxiosError,
} from '../authErrorHandler';

describe('authErrorHandler', () => {
  const axios401 = {
    response: {
      status: 401,
      data: { detail: 'Authentication credentials were not provided.' },
    },
  };

  it('detects 401 from axios and ApiError shapes', () => {
    expect(isUnauthorizedError(axios401)).toBe(true);
    expect(isUnauthorizedError(new ApiError('x', { status: 401 }))).toBe(true);
    expect(isUnauthorizedError(new ApiError('x', { status: 403 }))).toBe(false);
    expect(isUnauthorizedError({ detail: 'nope' })).toBe(false);
  });

  it('preserves status when rethrowing axios errors', () => {
    try {
      rethrowAxiosError(axios401, 'fallback');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(getErrorStatus(error)).toBe(401);
      expect(error.isUnauthorized).toBe(true);
    }
  });

  it('maps generic DRF 401 detail to a friendly Spanish message', () => {
    const apiError = createApiErrorFromAxios(axios401);
    expect(getUnauthorizedMessage(apiError)).toBe(
      'Por favor, inicia sesión para continuar.',
    );
  });

  it('extracts messages from legacy thrown response bodies', () => {
    expect(getErrorMessage({ detail: 'Token inválido' })).toBe('Token inválido');
    expect(getErrorMessage({ error: 'No permitido' })).toBe('No permitido');
  });

  describe('handleAuthError strategies', () => {
    it('IGNORE returns handled without side effects', () => {
      const navigate = vi.fn();
      const result = handleAuthError(axios401, {
        strategy: AUTH_ERROR_STRATEGY.IGNORE,
        navigate,
      });

      expect(result.handled).toBe(true);
      expect(result.ignored).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('REDIRECT navigates to login with return path', () => {
      const navigate = vi.fn();
      const result = handleAuthError(axios401, {
        strategy: AUTH_ERROR_STRATEGY.REDIRECT,
        returnTo: '/events/2',
        navigate,
      });

      expect(result.handled).toBe(true);
      expect(result.redirected).toBe(true);
      expect(navigate).toHaveBeenCalledWith(LOGIN_PATH, {
        replace: true,
        state: { from: { pathname: '/events/2' } },
      });
    });

    it('MESSAGE invokes onUnauthorized callback', () => {
      const onUnauthorized = vi.fn();
      const result = handleAuthError(axios401, {
        strategy: AUTH_ERROR_STRATEGY.MESSAGE,
        message: 'Inicia sesión para votar',
        onUnauthorized,
      });

      expect(result.handled).toBe(true);
      expect(result.message).toBe('Inicia sesión para votar');
      expect(onUnauthorized).toHaveBeenCalledWith('Inicia sesión para votar');
    });

    it('CLEAR_SESSION calls clearAuthState', () => {
      const clearAuthState = vi.fn();
      handleAuthError(axios401, {
        strategy: AUTH_ERROR_STRATEGY.CLEAR_SESSION,
        clearAuthState,
      });

      expect(clearAuthState).toHaveBeenCalledOnce();
    });

    it('returns handled:false for non-401 errors', () => {
      const navigate = vi.fn();
      const result = handleAuthError(
        { response: { status: 500, data: { error: 'boom' } } },
        { strategy: AUTH_ERROR_STRATEGY.REDIRECT, navigate },
      );

      expect(result.handled).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
