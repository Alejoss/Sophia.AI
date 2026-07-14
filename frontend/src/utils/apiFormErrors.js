const API_ERROR_TRANSLATIONS = {
  'Upload a valid image. The file you uploaded was either not an image or a corrupted image.':
    'La imagen no es válida. El archivo puede estar dañado o no ser una imagen compatible.',
  'This field may not be blank.': 'Este campo es requerido.',
  'This field is required.': 'Este campo es requerido.',
  'This field cannot be blank.': 'Este campo es requerido.',
  'Enter a valid email address.': 'Introduce un correo electrónico válido.',
  'A user with that username already exists.': 'Ya existe un usuario con ese nombre de usuario.',
  'A user with this email already exists.': 'Ya existe un usuario con ese correo electrónico.',
  'user with this username already exists.': 'Ya existe un usuario con ese nombre de usuario.',
  'user with this email already exists.': 'Ya existe un usuario con ese correo electrónico.',
  'Unable to log in with provided credentials.': 'Credenciales inválidas.',
};

const RESERVED_KEYS = new Set(['detail', 'error', 'non_field_errors']);

/**
 * Translate common DRF / Django validation messages to Spanish.
 *
 * @param {unknown} message
 * @returns {string}
 */
export function translateApiErrorMessage(message) {
  if (message == null) {
    return '';
  }

  const text = String(message).trim();
  return API_ERROR_TRANSLATIONS[text] || text;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeErrorValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => translateApiErrorMessage(item)).join(' ');
  }

  return translateApiErrorMessage(value);
}

/**
 * Extract field-level and general validation errors from ApiError / axios shapes.
 *
 * @param {unknown} error
 * @param {string|null} [fallback=null]
 * @returns {{ fieldErrors: Record<string, string>, generalError: string|null }}
 */
export function parseApiValidationErrors(error, fallback = null) {
  const data =
    error?.data ??
    error?.response?.data ??
    (error && typeof error === 'object' && !('message' in error) && !('status' in error)
      ? error
      : null);

  const fieldErrors = {};
  let generalError = null;

  if (!data) {
    return { fieldErrors, generalError: fallback };
  }

  if (typeof data === 'string') {
    return { fieldErrors, generalError: translateApiErrorMessage(data) };
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    return { fieldErrors, generalError: fallback };
  }

  for (const [key, value] of Object.entries(data)) {
    if (RESERVED_KEYS.has(key)) {
      continue;
    }

    const message = normalizeErrorValue(value);
    if (message) {
      fieldErrors[key] = message;
    }
  }

  if (data.non_field_errors) {
    generalError = normalizeErrorValue(data.non_field_errors);
  } else if (typeof data.detail === 'string') {
    generalError = translateApiErrorMessage(data.detail);
  } else if (typeof data.error === 'string') {
    generalError = translateApiErrorMessage(data.error);
  }

  if (!generalError && Object.keys(fieldErrors).length === 0) {
    generalError = fallback;
  }

  return { fieldErrors, generalError };
}

/**
 * Apply parsed API errors onto a react-hook-form instance via setError.
 * Field messages surface as helperText; returns generalError for an Alert if needed.
 *
 * @param {unknown} error
 * @param {(name: string, error: { type: string, message: string }) => void} setError
 * @param {string|null} [fallback=null]
 * @param {Record<string, string>} [fieldMap={}] Map API field names → form field names
 * @returns {{ fieldErrors: Record<string, string>, generalError: string|null }}
 */
export function applyApiErrorsToForm(error, setError, fallback = null, fieldMap = {}) {
  const { fieldErrors, generalError } = parseApiValidationErrors(error, fallback);

  for (const [apiField, message] of Object.entries(fieldErrors)) {
    const formField = fieldMap[apiField] || apiField;
    setError(formField, { type: 'server', message });
  }

  return { fieldErrors, generalError };
}
