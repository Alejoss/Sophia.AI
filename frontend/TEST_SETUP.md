# Frontend Testing Setup

This document describes how to set up and run tests for the frontend badge functionality.

## Prerequisites

Install the required testing dependencies:

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## Running Tests

Run all tests:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Test Coverage (forms)

Form-related suites live under each feature’s `__tests__/` folder and use `src/test/formTestUtils.jsx`. Typical coverage per form:

1. Invalid / empty submit → Spanish `helperText` or Alert; API not called  
2. Valid submit → mocked API / callback with expected payload  
3. API rejection → visible Spanish error (not console-only)

Helpers: `apiFormErrors.test.js`, `formSchemas.test.js`.

```bash
cd frontend
npm run test
```

## Notes

- Tests use Vitest as the test runner
- React Testing Library is used for component testing
- API calls are mocked using Vitest's vi.mock()
- Tests follow React Testing Library best practices
