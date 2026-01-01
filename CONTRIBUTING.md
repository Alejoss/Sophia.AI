# Contributing to Sophia.AI Academia Blockchain

Thank you for your interest in contributing to Sophia.AI Academia Blockchain! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Issue Guidelines](#issue-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Sophia.AI-Academia-Blockchain.git
   cd Sophia.AI-Academia-Blockchain
   ```
3. **Set up your development environment** following [Setup.md](Setup.md)
4. **Create a branch** for your work (see [Development Workflow](#development-workflow))

## Development Workflow

### Branch Naming Convention

Create branches using the issue code format: `${ISSUE-CODE}`

Issue codes follow this pattern:
- `DOCS-XXXX` - Documentation issues
- `FRONT-XXXX` - Frontend issues
- `BACK-XXXX` - Backend issues
- `OTHER-XXXX` - Other issues

Example: `FRONT-0123` for a frontend issue numbered 0123

### Workflow Steps

1. **Find or create an issue** in the GitHub Issues section
2. **Assign the issue to yourself** if you plan to work on it
3. **Create a feature branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b FRONT-0123
   ```
4. **Make your changes** following the code style guidelines
5. **Write or update tests** for your changes
6. **Update documentation** if needed
7. **Commit your changes** (see [Commit Guidelines](#commit-guidelines))
8. **Push to your fork**:
   ```bash
   git push origin FRONT-0123
   ```
9. **Create a Pull Request** from your fork to the main repository

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

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally (`docker-compose exec backend python manage.py test`)
- [ ] Documentation is updated if needed
- [ ] Commit messages follow the convention
- [ ] Branch is up to date with `main`

### PR Description Template

```markdown
## Description
Brief description of changes

## Related Issue
Closes #ISSUE-NUMBER

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe the tests you ran and their results

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. A project maintainer will review your PR
2. Address any feedback or requested changes
3. Once approved, your PR will be merged

## Commit Guidelines

### Commit Message Format

Start commit messages with the issue code:

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

