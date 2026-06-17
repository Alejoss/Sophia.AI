import { describe, expect, it } from 'vitest';
import { ApiError } from '../authErrorHandler';
import { parseApiValidationErrors } from '../apiFormErrors';

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
});
