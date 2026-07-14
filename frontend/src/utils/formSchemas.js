import * as yup from 'yup';

/** Shared Yup email rule (Spanish messages). */
export const emailField = (label = 'correo electrónico') =>
  yup
    .string()
    .trim()
    .required(`El ${label} es requerido.`)
    .email(`Introduce un ${label} válido.`);

const PASSWORD_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/;

/** Client-side password rules aligned with Register (Spanish). */
export function getPasswordRuleErrors(password = '') {
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
  if (!PASSWORD_SPECIAL.test(password)) {
    errors.push('Debe contener al menos un carácter especial (!@#$%^&*...)');
  }
  return errors;
}

export const passwordField = () =>
  yup
    .string()
    .required('La contraseña es requerida.')
    .test('password-rules', function passwordRules(value) {
      const ruleErrors = getPasswordRuleErrors(value || '');
      if (ruleErrors.length === 0) {
        return true;
      }
      return this.createError({ message: ruleErrors.join('\n') });
    });

export const usernameField = () =>
  yup
    .string()
    .trim()
    .required('El nombre de usuario es requerido.')
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
    .test(
      'no-at',
      'El nombre de usuario no puede contener el símbolo @. Usa solo letras, números y guiones bajos (_).',
      (value) => !String(value || '').includes('@'),
    )
    .matches(
      /^[a-zA-Z0-9_]+$/,
      'El nombre de usuario solo puede contener letras, números y guiones bajos (_).',
    );
