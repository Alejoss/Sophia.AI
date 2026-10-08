import * as yup from 'yup';
import i18n from '../i18n';

const PASSWORD_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/;

function translator(t) {
  return t || ((key, options) => i18n.t(key, options));
}

/** Shared Yup email rule. Messages resolve when the field is validated. */
export const emailField = (label, t) => {
  const tr = translator(t);
  const fieldLabel = () => label || tr('forms:email.defaultLabel');
  return yup
    .string()
    .trim()
    .required(() => tr('forms:email.required', { label: fieldLabel() }))
    .email(() => tr('forms:email.invalid', { label: fieldLabel() }));
};

/** Client-side password rules aligned with Register. */
export function getPasswordRuleErrors(password = '', t) {
  const tr = translator(t);
  const errors = [];
  if (password.length < 8) {
    errors.push(tr('forms:password.min'));
  }
  if (!/[A-Z]/.test(password)) {
    errors.push(tr('forms:password.upper'));
  }
  if (!/[a-z]/.test(password)) {
    errors.push(tr('forms:password.lower'));
  }
  if (!/[0-9]/.test(password)) {
    errors.push(tr('forms:password.number'));
  }
  if (!PASSWORD_SPECIAL.test(password)) {
    errors.push(tr('forms:password.special'));
  }
  return errors;
}

export const passwordField = (t) => {
  const tr = translator(t);
  return yup
    .string()
    .required(() => tr('forms:password.required'))
    .test('password-rules', function passwordRules(value) {
      const ruleErrors = getPasswordRuleErrors(value || '', tr);
      if (ruleErrors.length === 0) {
        return true;
      }
      return this.createError({ message: ruleErrors.join('\n') });
    });
};

export const usernameField = (t) => {
  const tr = translator(t);
  return yup
    .string()
    .trim()
    .required(() => tr('forms:username.required'))
    .min(3, () => tr('forms:username.min'))
    .test(
      'no-at',
      () => tr('forms:username.noAt'),
      (value) => !String(value || '').includes('@'),
    )
    .matches(/^[a-zA-Z0-9_]+$/, () => tr('forms:username.charset'));
};
