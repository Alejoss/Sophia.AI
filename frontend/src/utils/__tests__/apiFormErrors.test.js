import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../authErrorHandler';
import { applyApiErrorsToForm, parseApiValidationErrors } from '../apiFormErrors';

describe('apiFormErrors', () => {
  it('extracts field errors from ApiError data', () => {
    const error = new ApiError('Error creating event', {
      status: 400,
      data: {
        image: [
          'Upload a valid image. The file you uploaded was either not an image or a corrupted image.',
        ],
      },
    });

    const { fieldErrors, generalError } = parseApiValidationErrors(error);

    expect(fieldErrors.image).toBe(
      'La imagen no es válida. El archivo puede estar dañado o no ser una imagen compatible.',
    );
    expect(generalError).toBeNull();
  });

  it('translates common DRF required-field messages', () => {
    const { fieldErrors } = parseApiValidationErrors({
      response: { data: { title: ['This field is required.'] } },
    });

    expect(fieldErrors.title).toBe('Este campo es requerido.');
  });

  it('extracts general errors from detail and non_field_errors', () => {
    const { fieldErrors, generalError } = parseApiValidationErrors({
      data: { detail: 'No autorizado' },
    });

    expect(fieldErrors).toEqual({});
    expect(generalError).toBe('No autorizado');
  });

  it('uses fallback when no structured errors are present', () => {
    const { fieldErrors, generalError } = parseApiValidationErrors(
      new ApiError('Algo salió mal', { status: 500, data: {} }),
      'Error genérico',
    );

    expect(fieldErrors).toEqual({});
    expect(generalError).toBe('Error genérico');
  });

  it('applyApiErrorsToForm maps fields onto react-hook-form setError', () => {
    const setError = vi.fn();
    const { generalError } = applyApiErrorsToForm(
      { response: { data: { personal_note: ['This field may not be blank.'], error: 'Falló' } } },
      setError,
      null,
      { personal_note: 'personalNote' },
    );

    expect(setError).toHaveBeenCalledWith('personalNote', {
      type: 'server',
      message: 'Este campo es requerido.',
    });
    expect(generalError).toBe('Falló');
  });

  it('translates registration duplicate-user messages', () => {
    const { fieldErrors } = parseApiValidationErrors({
      response: {
        data: {
          email: ['A user with this email already exists.'],
          username: ['A user with that username already exists.'],
        },
      },
    });

    expect(fieldErrors.email).toBe('Ya existe un usuario con ese correo electrónico.');
    expect(fieldErrors.username).toBe('Ya existe un usuario con ese nombre de usuario.');
  });
});
