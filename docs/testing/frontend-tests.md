# Frontend Testing Guide

This guide covers testing patterns for the React frontend application.

## Test Framework

Frontend testing is currently being set up. The recommended approach:

- **Vitest** or **Jest** - Test runner
- **React Testing Library** - Component testing
- **MSW (Mock Service Worker)** - API mocking

## Test Structure

Tests should be located alongside components:

```
src/
  components/
    UserProfile.jsx
    UserProfile.test.jsx
```

## Example Test

```javascript
import { render, screen } from '@testing-library/react';
import UserProfile from './UserProfile';

describe('UserProfile', () => {
  it('renders user information', () => {
    const user = { username: 'testuser', email: 'test@example.com' };
    render(<UserProfile user={user} />);
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });
});
```

## Running Tests

```bash
npm test
```

## Related Documentation

- [Testing Strategy](strategy.md)
- [Frontend Development](../development/frontend/)

