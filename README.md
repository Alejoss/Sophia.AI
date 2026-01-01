# Sophia.AI Academia Blockchain

A decentralized, blockchain-backed educational platform that uses AI to interact with and certify documents. The platform enables users to create, share, and manage educational content with blockchain-based certification and verification.

## 🌟 Features

- **Content Management**: Create and organize educational content (videos, audio, text, images)
- **Knowledge Paths**: Structured learning paths with quizzes and assessments
- **Blockchain Certification**: Document certification and verification using smart contracts
- **User Profiles**: Comprehensive user profiles with cryptocurrency preferences
- **Social Features**: Comments, votes, bookmarks, and messaging
- **Events**: Create and manage educational events
- **Publications**: Share research and academic publications
- **Search**: Advanced content search functionality
- **Google OAuth**: Social authentication support

## 🏗️ Architecture

The platform consists of three main components:

1. **Backend (Django REST Framework)**: RESTful API server with PostgreSQL database
2. **Frontend (React + Vite)**: Modern single-page application with Material-UI and Tailwind CSS
3. **Smart Contracts (Solidity)**: Ethereum/Polygon smart contracts for blockchain functionality

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Git
- (Optional) Node.js and Python 3.12+ for local development

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Sophia.AI-Academia-Blockchain
```

2. Create environment files:
```bash
# Backend environment
cp acbc_app/.env.example acbc_app/.env
# Edit acbc_app/.env with your configuration

# Frontend environment
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your configuration
```

3. Start the services:
```bash
docker-compose up --build
```

4. Run database migrations:
```bash
docker-compose exec backend python manage.py migrate
```

5. Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/swagger/
- Django Admin: http://localhost:8000/admin

For detailed setup instructions, see [Setup.md](Setup.md) or [docs/deployment/local-development.md](docs/deployment/local-development.md).

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- **[Architecture](docs/architecture/)** - System design, data models, and blockchain integration
- **[API Documentation](docs/api/)** - Complete API reference, authentication, and examples
- **[Deployment](docs/deployment/)** - Local development, production deployment, and Docker configuration
- **[Development Guides](docs/development/)** - Backend, frontend, and smart contract development
- **[Testing](docs/testing/)** - Testing strategy and patterns
- **[Security](docs/security/)** - Security practices and best practices

## 🛠️ Tech Stack

### Backend
- **Framework**: Django 5.0
- **API**: Django REST Framework
- **Authentication**: JWT (Simple JWT), django-allauth
- **Database**: PostgreSQL 15
- **Blockchain**: Web3.py, Chainlink Functions
- **Documentation**: drf-yasg (Swagger/OpenAPI)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 5
- **UI Libraries**: Material-UI 6, Tailwind CSS 4
- **Routing**: React Router 6
- **HTTP Client**: Axios
- **Forms**: React Hook Form, Yup

### Smart Contracts
- **Language**: Solidity 0.8.24
- **Framework**: Hardhat
- **Libraries**: OpenZeppelin, Chainlink Contracts
- **Networks**: Polygon (Mainnet/Testnet), Hardhat (Local)

## 📁 Project Structure

```
Sophia.AI-Academia-Blockchain/
├── acbc_app/              # Django backend application
│   ├── academia_blockchain/  # Main Django project
│   ├── profiles/          # User profiles app
│   ├── content/           # Content management app
│   ├── certificates/     # Certificate management
│   ├── events/            # Events app
│   ├── knowledge_paths/   # Learning paths
│   ├── quizzes/           # Quiz system
│   └── ...                # Other Django apps
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── api/           # API client functions
│   │   ├── components/    # Reusable components
│   │   ├── profiles/      # Profile pages
│   │   ├── content/       # Content pages
│   │   └── ...            # Other features
├── contracts/             # Smart contracts
│   ├── contracts/         # Solidity contracts
│   ├── scripts/           # Deployment scripts
│   └── tasks/             # Hardhat tasks
├── docs/                  # Documentation
└── docker-compose.yml     # Docker orchestration
```

## 🔧 Development

### Running Tests

```bash
# Backend tests
docker-compose exec backend python manage.py test -v 2

# Or with pytest
docker-compose exec backend pytest

# Specific app tests
docker-compose exec backend python manage.py test profiles -v 2
```

### Database Management

```bash
# Create migrations
docker-compose exec backend python manage.py makemigrations

# Apply migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py create_admin

# Populate test data
docker-compose exec backend python manage.py populate_users
docker-compose exec backend python manage.py populate_content
```

### Frontend Development

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Code style and standards
- Pull request process
- Issue reporting
- Development workflow

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Test Server**: https://sophia-ai.algobeat.com/
- **API Server**: https://sophia-ai-api.algobeat.com/
- **API Documentation**: http://localhost:8000/swagger/ (when running locally)

## 📧 Contact

For questions or support, please contact: academiablockchain@gmail.com

## 🗺️ Roadmap

- Enhanced blockchain integration
- Improved AI document processing
- Mobile application
- Advanced analytics and reporting

---

**Note**: This is an active development project. For the latest updates, check the [CHANGELOG.md](CHANGELOG.md).

