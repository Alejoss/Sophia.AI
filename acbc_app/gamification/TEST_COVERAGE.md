# Badge Functionality Test Coverage

This document summarizes the comprehensive test coverage for the badges functionality.

## Backend Tests

### Gamification Tests (`gamification/tests.py`)

#### Badge Model Tests
- ✅ Badge creation and attributes
- ✅ Badge string representation
- ✅ Unique code constraint
- ✅ Inactive badge handling

#### UserBadge Model Tests
- ✅ UserBadge creation
- ✅ Unique constraint (user + badge)
- ✅ String representation

#### Badge Rules Tests
- ✅ Badge awarding (success, duplicate, invalid code)
- ✅ `has_badge` helper function
- ✅ `check_first_comment` rule
- ✅ `check_knowledge_seeker` rule (with sufficient/insufficient nodes)
- ✅ `check_first_knowledge_path_completed` rule
- ✅ `check_first_highly_rated_comment` rule (with sufficient/insufficient votes)
- ✅ `check_first_highly_rated_content` rule (with sufficient/insufficient votes)
- ✅ `check_first_knowledge_path_created` rule (with sufficient/insufficient nodes)
- ✅ `check_quiz_master` rule (with sufficient/insufficient perfect scores)
- ✅ `check_community_voice` rule
- ✅ `check_content_creator` rule (with sufficient/insufficient contents)
- ✅ **NEW:** `check_topic_curator` rule (with all edge cases)
- ✅ **NEW:** `check_topic_architect` rule (with all edge cases)
- ✅ Profile points update on badge award
- ✅ Context data handling

#### Badge Signals Tests
- ✅ Comment creation triggers first comment badge
- ✅ Node completion triggers knowledge seeker badge
- ✅ Vote count update triggers highly rated comment badge
- ✅ Vote count update triggers highly rated content badge
- ✅ Quiz attempt triggers quiz master badge
- ✅ Node creation triggers path creator badge
- ✅ Signal not triggered on update (only create)
- ✅ Signal not triggered for incomplete nodes
- ✅ Signal not triggered for non-perfect quiz scores

#### Badge API Tests
- ✅ List badges (public access)
- ✅ Retrieve specific badge
- ✅ List user badges (authenticated)
- ✅ List user badges (unauthenticated - requires auth)
- ✅ Grant badge (admin only)
- ✅ Grant badge (non-admin - forbidden)
- ✅ Grant duplicate badge (error handling)
- ✅ Get user points

#### Badge Serializer Tests
- ✅ BadgeSerializer
- ✅ UserBadgeSummarySerializer

### Profiles Tests (`profiles/tests.py`)

#### Featured Badge Tests (NEW)
- ✅ Set featured badge
- ✅ Remove featured badge
- ✅ Set featured badge not owned (validation)
- ✅ Set non-existent badge (error handling)
- ✅ Get profile with featured badge
- ✅ `can_set_featured_badge` model method

## Frontend Tests

### BadgeDisplay Component Tests (`src/gamification/__tests__/BadgeDisplay.test.jsx`)
- ✅ Renders badge with correct name
- ✅ Hides badge name when `showName` is false
- ✅ Renders badge icon with correct alt text
- ✅ Uses mapped icon when database icon unavailable
- ✅ Uses database icon when available
- ✅ Falls back to default icon on image error
- ✅ Applies correct size based on context
- ✅ Applies correct size based on explicit size prop
- ✅ Handles badge with code property (alternative format)
- ✅ Handles missing badge data gracefully

### BadgeList Component Tests (`src/gamification/__tests__/BadgeList.test.jsx`)
- ✅ Renders loading state
- ✅ Renders error state
- ✅ Renders empty state
- ✅ Renders custom empty message
- ✅ Renders list of badges
- ✅ Renders badge descriptions
- ✅ Renders custom title
- ✅ Displays earning description in tooltip
- ✅ Handles badges with context data
- ✅ Handles badge with earned_at date
- ✅ Handles missing badge properties gracefully

### FeaturedBadgeSelector Component Tests (`src/gamification/__tests__/FeaturedBadgeSelector.test.jsx`)
- ✅ Renders message when no badges available
- ✅ Renders badges list
- ✅ Highlights currently selected badge
- ✅ Allows selecting a badge
- ✅ Allows removing featured badge
- ✅ Calls onUpdate after saving
- ✅ Disables save button when no changes
- ✅ Shows success message after saving
- ✅ Shows error message on save failure
- ✅ Sends empty string when removing badge

### useBadges Hook Tests (`src/gamification/__tests__/useBadges.test.js`)
- ✅ Fetches own badges when userId is null
- ✅ Fetches user badges when userId is provided
- ✅ Handles API errors gracefully
- ✅ Handles empty badges array
- ✅ Provides refetch function
- ✅ Handles getUserBadges with array response

### useAllBadges Hook Tests
- ✅ Fetches all badges
- ✅ Handles array response format
- ✅ Handles errors

### Badge Icon Map Tests (`src/gamification/__tests__/badgeIconMap.test.js`)
- ✅ Returns correct icon path for known badge codes
- ✅ Returns default icon for unknown badge codes
- ✅ Returns default icon for null/undefined badge codes
- ✅ Returns correct icon for all CONTRIBUTION badges
- ✅ Returns correct icon for all LEARNING badges
- ✅ Returns correct icon for all RECOGNITION badges
- ✅ Returns copy of badge icon map
- ✅ Contains all expected badge codes

## Test Statistics

- **Backend Tests:** ~50+ test cases covering models, rules, signals, API, serializers, and featured badge functionality
- **Frontend Tests:** ~40+ test cases covering components, hooks, and utilities
- **Total Coverage:** Comprehensive coverage of all badge functionality including edge cases and error handling

## Running Tests

### Backend
```bash
cd acbc_app
python manage.py test gamification.tests
python manage.py test profiles.tests
```

### Frontend
```bash
cd frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm run test
```

## Notes

- All tests follow Django and React Testing Library best practices
- Tests include both positive and negative test cases
- Edge cases and error handling are thoroughly covered
- API calls are properly mocked in frontend tests
- Tests are isolated and can run independently
