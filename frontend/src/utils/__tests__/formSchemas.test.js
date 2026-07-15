import { describe, expect, it } from 'vitest';
import {
  emailField,
  getPasswordRuleErrors,
  passwordField,
  usernameField,
} from '../formSchemas';

describe('formSchemas', () => {
  describe('emailField', () => {
    const schema = emailField();

    it('rejects empty email', async () => {
      await expect(schema.validate('')).rejects.toThrow(/requerido/i);
    });

    it('rejects invalid email', async () => {
      await expect(schema.validate('not-an-email')).rejects.toThrow(/válido/i);
    });

    it('accepts valid email', async () => {
      await expect(schema.validate('user@example.com')).resolves.toBe('user@example.com');
    });
  });

  describe('usernameField', () => {
    const schema = usernameField();

    it('rejects short username', async () => {
      await expect(schema.validate('ab')).rejects.toThrow(/3 caracteres/i);
    });

    it('rejects @ in username', async () => {
      await expect(schema.validate('user@name')).rejects.toThrow(/@/);
    });

    it('rejects invalid characters', async () => {
      await expect(schema.validate('user name')).rejects.toThrow(/letras, números/i);
    });

    it('accepts valid username', async () => {
      await expect(schema.validate('user_01')).resolves.toBe('user_01');
    });
  });

  describe('passwordField / getPasswordRuleErrors', () => {
    it('lists all missing password rules', () => {
      const errors = getPasswordRuleErrors('weak');
      expect(errors.length).toBeGreaterThan(1);
      expect(errors.some((e) => /8 caracteres/i.test(e))).toBe(true);
    });

    it('accepts a strong password', async () => {
      await expect(passwordField().validate('Str0ng!pass')).resolves.toBe('Str0ng!pass');
    });

    it('rejects weak password with Spanish message', async () => {
      await expect(passwordField().validate('short')).rejects.toThrow(/caracteres|mayúscula|número/i);
    });
  });
});
