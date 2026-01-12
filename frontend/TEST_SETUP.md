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

## Test Files

- `src/gamification/__tests__/BadgeDisplay.test.jsx` - Tests for BadgeDisplay component
- `src/gamification/__tests__/BadgeList.test.jsx` - Tests for BadgeList component
- `src/gamification/__tests__/FeaturedBadgeSelector.test.jsx` - Tests for FeaturedBadgeSelector component
- `src/gamification/__tests__/useBadges.test.js` - Tests for useBadges hook
- `src/gamification/__tests__/badgeIconMap.test.js` - Tests for badge icon mapping utilities

## Test Coverage

The tests cover:
- Badge display and rendering
- Badge list functionality
- Featured badge selection
- Badge data fetching hooks
- Badge icon mapping
- Error handling
- Loading states
- Edge cases

## Notes

- Tests use Vitest as the test runner
- React Testing Library is used for component testing
- API calls are mocked using Vitest's vi.mock()
- Tests follow React Testing Library best practices
