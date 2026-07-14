# Frontend forms standard

This guide defines how forms are built in the React frontend. All new and touched forms should follow it.

**Stack:** React Hook Form (RHF) + Yup + MUI  
**Language:** Spanish for all user-facing validation and API error messages (no multi-locale i18n required for now)

## Goals

- Consistent validation and feedback across the app
- Field-level errors the user can fix in place
- Clear loading / submit state (no double submit)
- API validation errors mapped into the same UI pattern
- Auth flows keep the documented token contract (see [Authentication API](../api/authentication.md))

## Required pattern

```jsx
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { TextField, Button, Alert, Box } from '@mui/material';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
// Optional shared rules:
import { emailField, usernameField, passwordField } from '../utils/formSchemas';

const schema = yup.object({
  title: yup.string().trim().required('El título es requerido.'),
});

const ExampleForm = () => {
  const [generalError, setGeneralError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { title: '' },
  });

  const onSubmit = async (data) => {
    setGeneralError('');
    try {
      await api.createSomething(data);
      // navigate / close / success Alert
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        'No se pudo guardar. Inténtalo de nuevo.',
      );
      if (parsed) setGeneralError(parsed);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {generalError && <Alert severity="error">{generalError}</Alert>}
      <TextField
        label="Título"
        {...register('title')}
        error={!!errors.title}
        helperText={errors.title?.message}
        fullWidth
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar'}
      </Button>
    </Box>
  );
};
```

## Feedback rules

| Kind | Where | Notes |
|------|--------|--------|
| Field validation / API field error | MUI `TextField` `error` + `helperText` (red) | Primary channel |
| General / non-field API error (`detail`, `error`, `non_field_errors`) | `Alert severity="error"` above the form | Do not use `window.alert()` |
| Success | Prefer navigate / close modal, or `Alert severity="success"` / Snackbar if the user stays on the page | Keep messages in Spanish |
| Loading | Disable submit (`isSubmitting`) + label like `Guardando…` / `Creando…` | Cancel usually disabled while submitting |

## Shared utilities

| Module | Use for |
|--------|---------|
| `frontend/src/utils/apiFormErrors.js` | `parseApiValidationErrors`, `applyApiErrorsToForm`, Spanish DRF translations |
| `frontend/src/utils/formSchemas.js` | `emailField`, `usernameField`, `passwordField`, `getPasswordRuleErrors` |

### `applyApiErrorsToForm(error, setError, fallback?, fieldMap?)`

- Maps API field keys onto RHF `setError` (so they appear as `helperText`)
- Returns `{ fieldErrors, generalError }` for the top-level Alert
- Use `fieldMap` when API snake_case ≠ form field names, e.g. `{ personal_note: 'personalNote' }`
- Add new English→Spanish strings to `API_ERROR_TRANSLATIONS` when you see repeated DRF messages

### Controllers

Use `Controller` for MUI controls that don’t work cleanly with `register` alone: `Select`, `Switch`, `Checkbox`, `Autocomplete`, custom date pickers, multi-selects.

### Files outside RHF

Optional / awkward controls may stay in `useState` next to RHF:

- Image / file inputs (`File` objects)
- Chip tag editors (e.g. interests)
- Nested question builders (Quiz uses hybrid: RHF for meta + local state for questions)
- Pure confirm dialogs with no text fields (payment accept, etc.)

Still use Spanish messages and never leave API failures only in `console.error`.

## Auth forms (special care)

Read [Authentication API](../api/authentication.md) and [Authentication security](../security/authentication.md) before changing Login / Register / Google / change-password / EditProfile username.

- **Register:** `POST /api/profiles/register/` body is only `{ username, email, password }` — never send `confirmPassword`
- **Login:** `username` may be username or email; body `{ username, password }`
- On success: require `access_token` in the response before calling `updateAuthState(userData, access_token)`
- Refresh token is HTTP-only cookie `acbc_refresh_token` set by the backend — do not read, write, or log it
- Never log access or refresh tokens
- **EditProfile username change:** only send `username` when allowed; if API returns updated `user`, call `updateAuthState(user, currentAccessToken)`

Reference implementations: `profiles/Login.jsx`, `profiles/Register.jsx`, `profiles/EditProfile.jsx`, `profiles/Profile.jsx` (`SecuritySection`).

## Error / load vs submit

When a page loads data then edits it:

- `loadError` → may block the form if data never arrived
- `submitError` / `generalError` → **must not** unmount the form (show Alert inline)

Broken pattern (avoid): `if (error) return <Alert />` after a failed save.

## PR checklist

- [ ] RHF + Yup (or intentional hybrid documented in the PR)
- [ ] Spanish messages for client and mapped API errors
- [ ] Field errors via `helperText`; general via `Alert`
- [ ] `noValidate` on `<form>`
- [ ] Submit disabled + loading label while pending
- [ ] `applyApiErrorsToForm` (or `parseApiValidationErrors`) on API failure — not `alert()`, not console-only
- [ ] Auth contracts unchanged if the form touches tokens / register / login
- [ ] Cancel / close blocked or safe while submitting

## Testing

- Helper unit tests: `frontend/src/utils/__tests__/apiFormErrors.test.js`, `formSchemas.test.js`
- Form component suites (Vitest + React Testing Library) live next to components under `__tests__/`, using `src/test/formTestUtils.jsx`
- Each form suite covers: invalid submit (Spanish error, no API), valid submit (API/callback), and API rejection (visible Spanish error)
- Run form-related tests:
  ```bash
  cd frontend && npm run test
  ```
- Always smoke-test Login, Register, and FormData/file uploads manually before merge when touching auth or uploads

- Most form components now have Vitest + React Testing Library suites colocated in the module's
  `__tests__` folder (e.g. `profiles/__tests__/EditProfile.test.jsx`, `topics/__tests__/ContentSuggestionModal.test.jsx`,
  `topics/timeline/__tests__/TopicTimelineEntryForm.test.jsx`, reject-dialog managers under
  `topics/__tests__` and `topics/timeline/__tests__`). Each suite covers, where applicable: (1) invalid
  submit shows the Spanish field error and does not call the API, (2) valid submit calls the
  API/callback with the expected payload, and (3) an API error surfaces a visible Spanish message.
  Use `frontend/src/test/formTestUtils.jsx` (`renderWithProviders`, `mockAuthValue`,
  `unauthenticatedAuth`) to render forms with `AuthContext` + `MemoryRouter`, and follow the existing
  suites (`profiles/__tests__/Login.test.jsx`, `knowledgePaths/__tests__/*`, `events/__tests__/*`) as
  the reference pattern for new form tests.

## Exceptions (acceptable)

| Surface | Why |
|---------|-----|
| Google SocialLogin button | OAuth widget, not a field form |
| ImageUploadModal / file-only dialogs | Primarily file + crop UI |
| Confirm-only dialogs | No validated fields |
| KnowledgePathEdit autosave chrome | Not a classic submit form; still should surface errors in Spanish when touched |

## Related docs

- [API errors](../api/errors.md)
- [Authentication API](../api/authentication.md)
- [Frontend testing](../testing/frontend-tests.md)
