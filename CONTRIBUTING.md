# Contributing to Sophia.AI Academia Blockchain

Thank you for your interest in contributing to Sophia.AI Academia Blockchain! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Issue Guidelines](#issue-guidelines)
- [Change Review Process](#change-review-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

Clone the repository and follow [Setup.md](Setup.md). All development and documentation work takes place directly on `develop`.

## Development Workflow

1. Verify the current branch is `develop` before editing, staging or committing. If it is not, stop and preserve existing work before switching.
2. Work only on `develop`; do not create feature branches, modify `main`, or open pull requests into `main`.
3. Make one focused change at a time, with relevant tests and documentation.
4. Review the diff and run the appropriate local checks.
5. Commit the reviewed changes directly to `develop`. Use an actual issue code when available; never invent issue numbers.
6. If publishing changes is requested, push only `develop`. Do not force-push, merge into `main`, or deploy as part of this workflow.

This section is the canonical Git workflow for the whole repository. Current CI runs automatically on `main`, not `develop`; validate locally rather than changing branches to trigger CI. Manual dispatch also publishes images and is a separate release operation.

## Issue Guidelines

### Creating Issues

When creating a new issue:

1. Go to the GitHub project "Issues" section
2. Click "New issue"
3. Use the following title format: `${ISSUE-CODE}: ${short explanation}`
   - Example: `BACK-0456: Fix authentication token refresh`
4. Provide a clear description including:
   - What the issue is
   - Steps to reproduce (for bugs)
   - Expected behavior
   - Actual behavior (for bugs)
   - Environment details if relevant

### Issue Code Format

- **DOCS** - Documentation-related issues
- **FRONT** - Frontend-related issues
- **BACK** - Backend-related issues
- **OTHER** - Other types of issues

Followed by a slash and a four-digit number (e.g., `0123`, `0456`).

## Change Review Process

Before committing to `develop`:

- Review the complete diff and exclude unrelated changes.
- Run relevant tests and record their results and limitations.
- Update documentation and comments where behavior changes.
- Summarize the problem, resulting behavior and validation in the commit.

Review takes place on the local diff; a pull request into `main` is not part of this process.

## Commit Guidelines

### Commit Message Format

When an actual issue exists, start commit messages with its issue code. Otherwise use a descriptive prefix such as `docs:` or `fix:`:

```
FRONT-0123: Add user profile edit functionality
BACK-0456: Fix JWT token refresh endpoint
DOCS-0789: Update API documentation
```

### Commit Message Best Practices

- Use imperative mood ("Add feature" not "Added feature")
- Keep the first line under 72 characters
- Provide additional context in the body if needed
- Reference related issues: `Fixes #123` or `Closes #456`

### Examples

```bash
# Good
git commit -m "FRONT-0123: Implement user profile edit form"

# Better (with body)
git commit -m "FRONT-0123: Implement user profile edit form

- Add EditProfile component
- Integrate with profiles API
- Add form validation
- Update routing"
```

## Code Style

### Python (Backend)

- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) style guide
- Use type hints where appropriate
- Maximum line length: 100 characters
- Use meaningful variable and function names
- Add docstrings to functions and classes

```python
def get_user_profile(user_id: int) -> Profile:
    """
    Retrieve a user profile by ID.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        Profile object or None if not found
    """
    return Profile.objects.filter(user_id=user_id).first()
```

### JavaScript/React (Frontend)

- Follow ESLint configuration
- Use functional components with hooks
- Use meaningful component and variable names
- Keep components focused and reusable
- Use PropTypes or TypeScript for type checking

```javascript
// Good
const UserProfile = ({ userId, onEdit }) => {
  // Component logic
};

// Add PropTypes
UserProfile.propTypes = {
  userId: PropTypes.number.isRequired,
  onEdit: PropTypes.func,
};
```

### Solidity (Smart Contracts)

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use NatSpec comments for documentation
- Follow naming conventions (PascalCase for contracts, camelCase for functions)

## Testing

### Backend Tests

- Write tests for new features and bug fixes
- Use Django's test framework or pytest
- Aim for good test coverage
- Test both success and error cases

```bash
# Run all tests
docker-compose exec backend python manage.py test

# Run specific app tests
docker-compose exec backend python manage.py test profiles

# Run with coverage
docker-compose exec backend pytest --cov=. --cov-report=html
```

### Frontend Tests

- Write unit tests for components
- Test user interactions
- Test API integration (use mocks when appropriate)

## Documentation

### Code Documentation

- Add docstrings to functions and classes
- Document complex logic with inline comments
- Update README files when adding new features

### API Documentation

- Update Swagger/OpenAPI annotations when modifying endpoints
- Include request/response examples
- Document error codes and messages

### User Documentation

- Update user-facing documentation for new features
- Add examples where helpful
- Keep documentation up to date with code changes

## Questions?

If you have questions about contributing:

1. Check existing documentation in the `docs/` directory
2. Search existing issues for similar questions
3. Create a new issue with the `OTHER-XXXX` prefix
4. Contact: academiablockchain@gmail.com

## Recognition

Contributors will be recognized in:
- Project README (for significant contributions)
- Release notes
- Project documentation

Thank you for contributing to Sophia.AI Academia Blockchain! 🚀

