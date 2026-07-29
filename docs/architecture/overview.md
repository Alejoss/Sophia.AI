# System Architecture Overview

This document provides a high-level overview of the Sophia.AI Academia Blockchain platform architecture.

## System Components

The platform consists of three main components:

```mermaid
graph TB
    subgraph "Frontend"
        React[React Application]
        Vite[Vite Build Tool]
    end
    
    subgraph "Backend"
        Django[Django REST Framework]
        PostgreSQL[(PostgreSQL Database)]
    end
    
    subgraph "Blockchain"
        Contracts[Smart Contracts]
        Polygon[Polygon Network]
        Chainlink[Chainlink Functions]
    end
    
    React -->|HTTP/REST| Django
    Django -->|ORM| PostgreSQL
    Django -->|Web3| Contracts
    Contracts -->|Deployed on| Polygon
    Contracts -->|Uses| Chainlink
```

## Architecture Layers

### 1. Presentation Layer (Frontend)

**Technology**: React 18 + Vite 5

- **Purpose**: User interface and user experience
- **Key Features**:
  - Single Page Application (SPA)
  - Material-UI and Tailwind CSS for styling
  - React Router for navigation
  - Context API for state management
  - Axios for API communication

**Main Modules**:
- User authentication and profiles
- Content management and display
- Knowledge paths and quizzes
- Events and publications
- Messaging and notifications

### 2. Application Layer (Backend)

**Technology**: Django 5.0 + Django REST Framework

- **Purpose**: Business logic, API endpoints, and data processing
- **Key Features**:
  - RESTful API design
  - JWT authentication
  - Google OAuth integration
  - File upload and media management
  - Search functionality
  - Web3 integration for blockchain operations

**Main Django Apps**:
- `profiles` - User profiles and authentication
- `content` - Content management (videos, audio, text, images) and Topics/timelines
- `certificates` - Certificate generation and management
- `events` - Event management
- `knowledge_paths` - Learning paths and nodes
- `book_clubs` - Club de Lectura hub (cohorts over paths, topics, events, Foro, and Investigación)
- `quizzes` - Quiz system
- `comments` - Comment system
- `votes` - Voting system
- `bookmarks` - Bookmarking
- `user_messages` - Messaging system
- `search` - Search functionality
- `notifications` - Notification storage (django-notifications-hq; API exposed via `profiles`)

See also: [Club de Lectura](book-clubs.md), [Topics & Knowledge Paths](topics-and-knowledge-paths.md).

### 3. Data Layer

**Technology**: PostgreSQL 15

- **Purpose**: Persistent data storage
- **Features**:
  - Relational database
  - ACID compliance
  - Foreign key relationships
  - Full-text search capabilities

### 4. Blockchain Layer

**Technology**: Bitcoin (OP_RETURN) for transcript certification; optional Hardhat/EVM contracts for legacy experiments

- **Purpose**: Decentralized certification and verification
- **Components**:
  - Bitcoin `OP_RETURN` anchors for transcript `text_hash` (current product path)
  - Legacy/experimental EVM contracts (Polygon / Hardhat) for params and other hashes
  - Chainlink Functions only for those EVM experiments

## Data Flow

### User Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Google
    
    User->>Frontend: Login Request
    Frontend->>Google: OAuth Request
    Google->>Frontend: OAuth Token
    Frontend->>Backend: Exchange Token
    Backend->>Backend: Verify & Create User
    Backend->>Frontend: JWT Tokens
    Frontend->>Frontend: Store Tokens
```

### Content Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database
    participant Storage
    
    User->>Frontend: Upload Content
    Frontend->>Backend: POST /api/content/
    Backend->>Backend: Validate & Process
    Backend->>Storage: Save Media File
    Backend->>Database: Create Content Record
    Database->>Backend: Content ID
    Backend->>Frontend: Success Response
```

### Transcript certification flow (Bitcoin)

Product path: anchor `ContentTranscript.text_hash` in a Bitcoin `OP_RETURN`.
See [blockchain-integration.md](blockchain-integration.md) and
[transcript-anchor.md](../api/transcript-anchor.md).

```mermaid
sequenceDiagram
    participant User
    participant API as Django API
    participant Ops as Ops CLI
    participant BTC as Bitcoin

    User->>API: POST prepare TranscriptAnchor
    API->>User: pending + OP_RETURN hex
    Ops->>BTC: Broadcast OP_RETURN tx
    Ops->>API: Store btc_txid / confirmations
    User->>BTC: Verify hash in explorer
```

## Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 18.3.1 |
| Build Tool | Vite | 5.2.0 |
| UI Libraries | Material-UI, Tailwind CSS | 6.4.3, 4.0.7 |
| Backend Framework | Django | 5.0 |
| API Framework | Django REST Framework | 3.15.2 |
| Database | PostgreSQL | 15 |
| Authentication | JWT, django-allauth | Simple JWT, 64.0.0 |
| Blockchain | Solidity, Hardhat | 0.8.24, 2.22.4 |
| Containerization | Docker, Docker Compose | Latest |

## Deployment Architecture

### Development Environment

```
┌─────────────────┐
│   React (5173)  │
└────────┬────────┘
         │
┌────────▼────────┐
│ Django (8000)   │
└────────┬────────┘
         │
┌────────▼────────┐
│  PostgreSQL     │
└─────────────────┘
```

### Production Environment

```
┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │
│   (Vite)     │     │   (Django)   │
└──────────────┘     └──────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  PostgreSQL   │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  AWS S3       │
                    │  (Media)      │
                    └───────────────┘
```

## Security Architecture

- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Django permissions and custom decorators
- **CORS**: Configured for specific origins
- **CSRF**: Token-based protection
- **Data Validation**: Serializer validation and model constraints
- **Blockchain Security**: Platform Bitcoin WIF stays server-side; EVM keys never in frontend

## Scalability Considerations

- **Horizontal Scaling**: Stateless backend allows multiple instances
- **Database**: PostgreSQL supports read replicas
- **Caching**: Can be added with Redis
- **CDN**: Static files can be served via CDN
- **Blockchain**: Bitcoin for transcript proofs; Polygon only if using legacy EVM contracts

## Related Documentation

- [Data Models](data-models.md) - Detailed database schema
- [API Design](api-design.md) - API architecture details
- [Blockchain Integration](blockchain-integration.md) - Bitcoin transcript anchors + legacy EVM
- [Transcript certification](../api/transcript-anchor.md) - OP_RETURN API and ops CLI
- [Deployment Guide](../deployment/production.md) - Production deployment

