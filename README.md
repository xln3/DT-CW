# Arts Troupe Management System

A comprehensive web-based management system for arts troupes/dance teams, featuring member management, rehearsal scheduling, and **AI-powered face recognition attendance**.

## Features

### Core Management
- **Member Management** - Track member information, contact details, and program assignments
- **Teacher Management** - Manage instructors with payment tracking and application processing
- **Program Management** - Create programs/shows and assign members with role designations
- **Rehearsal Scheduling** - Schedule rehearsals with teacher assignments and automatic notifications
- **Semester Management** - Organize programs and activities by academic terms

### Attendance System
- **Face Recognition Attendance** - Automatic check-in/check-out via group photo analysis
- **Dual Photo Verification** - Before and after photos to detect late arrivals and early leaves
- **Manual Override** - Support for leave requests and manual attendance corrections
- **Public Attendance Display** - Searchable public page for members to check their records

### AI Face Recognition
- **InsightFace Integration** - State-of-the-art face detection and recognition
- **Distinguishability-Based Registration** - Registration success depends on being distinguishable from other members
- **Program-Scoped Matching** - Reduces false matches by limiting search to program participants
- **9-Grid Challenge Verification** - Gamified face verification for improved accuracy
- **Error Calibration System** - Tracks recognition errors and generates calibration tasks

### Additional Features
- **Public Calendar** - Shareable rehearsal schedule view
- **Member Portal** - Self-service portal for members to view their attendance and program info
- **Budget Tracking** - Program and event budget management
- **Venue Management** - Track rehearsal and performance venues
- **Audit Logging** - Complete activity tracking for accountability

## Tech Stack

### Backend
- **Python 3.8+** with Flask 3.0
- **SQLAlchemy 2.0** ORM (SQLite/PostgreSQL)
- **Flask-JWT-Extended** for authentication
- **InsightFace** for face recognition
- **OpenCV** + **Pillow** for image processing

### Frontend
- **React 19** with TypeScript
- **Vite 7** build tool
- **TanStack Query** for data fetching
- **Zustand** for state management
- **Tailwind CSS 4** for styling
- **React Router 7** for navigation

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/xln3/DT-CW.git
   cd DT-CW
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Start the development servers**

   Backend (Terminal 1):
   ```bash
   cd backend
   source venv/bin/activate
   python app.py
   # Server runs at http://localhost:5000
   ```

   Frontend (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   # Server runs at http://localhost:3000
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:5000/api

### Default Admin Account
On first startup, a default admin account is created:
- **Username:** `admin`
- **Password:** `admin123`

> **Warning:** Change this password immediately in production!

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Flask
FLASK_ENV=development  # or production
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here

# Database (default: SQLite)
DATABASE_URL=sqlite:///arts_management.db
# For PostgreSQL:
# DATABASE_URL=postgresql://user:pass@localhost/dbname

# Face Recognition (optional)
FACE_MOCK_MODE=false  # Set to true for development without AI models
```

### Face Recognition Setup

The face recognition system uses InsightFace with the `buffalo_l` model pack. On first run, models will be automatically downloaded (~100MB).

For GPU acceleration:
```bash
pip install onnxruntime-gpu
```

To run without face recognition (development/testing):
```bash
export FACE_MOCK_MODE=true
```

## Project Structure

```
├── backend/
│   ├── app.py              # Flask application factory
│   ├── config.py           # Configuration classes
│   ├── database.py         # SQLAlchemy setup
│   ├── auth/               # Authentication module
│   │   ├── decorators.py   # @login_required, @role_required
│   │   ├── jwt_handler.py  # Token generation/validation
│   │   └── permissions.py  # Permission checking logic
│   ├── models/             # SQLAlchemy ORM models
│   ├── routes/             # API endpoints (Flask Blueprints)
│   ├── face_recognition/   # AI face recognition module
│   │   ├── core/           # Feature extraction, matching
│   │   └── services/       # Registration, recognition services
│   └── tests/              # pytest test suite
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Root component with routing
│   │   ├── types/          # TypeScript type definitions
│   │   ├── services/       # API client (Axios)
│   │   ├── contexts/       # React Context (Auth)
│   │   ├── components/     # Reusable UI components
│   │   └── pages/          # Page components
│   │       ├── admin/      # Admin dashboard pages
│   │       ├── member/     # Member portal pages
│   │       └── public/     # Public-facing pages
│   └── vite.config.ts      # Vite configuration
│
└── assets/                 # Static assets
```

## API Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Admin Endpoints (Authenticated)
| Resource | Endpoints |
|----------|-----------|
| Members | `/api/admin/members/*` |
| Teachers | `/api/admin/teachers/*` |
| Programs | `/api/admin/programs/*` |
| Rehearsals | `/api/admin/rehearsals/*` |
| Users | `/api/admin/users/*` |
| Semesters | `/api/admin/semesters/*` |

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/attendance/overview` | Attendance summary |
| GET | `/api/public/attendance/programs/:id` | Program attendance |
| GET | `/api/public/attendance/members` | Member attendance search |
| GET | `/api/public/calendar` | Public calendar |

### Face Recognition Endpoints
See [Face Recognition Module Documentation](backend/face_recognition/README.md) for detailed API reference.

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | System administrator | Full access to all features |
| `committee` | Committee member | Manage all programs |
| `program_manager` | Program manager | Manage assigned programs only |
| `member` | Team member | View own attendance, update profile |

## Development

### Running Tests

Backend:
```bash
cd backend
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest --cov=.            # With coverage report
pytest tests/test_auth.py # Specific test file
```

Frontend:
```bash
cd frontend
npm run lint              # ESLint check
npm run build             # Type check + build
```

### Database

The project uses SQLite by default. For development, you can reset the database:

```bash
rm backend/arts_management.db
python backend/app.py  # Recreates tables on startup
```

For production, use PostgreSQL with proper migrations (Alembic recommended).

## Deployment

### Production Checklist
- [ ] Change default admin password
- [ ] Set strong `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Configure PostgreSQL database
- [ ] Set up HTTPS with proper certificates
- [ ] Configure CORS for your domain
- [ ] Set `FLASK_ENV=production`
- [ ] Set up database migrations with Alembic
- [ ] Configure cloud storage for uploaded photos

### Docker (Coming Soon)
Docker deployment support is planned for future releases.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [InsightFace](https://github.com/deepinsight/insightface) for face recognition
- [Flask](https://flask.palletsprojects.com/) for the backend framework
- [React](https://react.dev/) for the frontend framework
- [Tailwind CSS](https://tailwindcss.com/) for styling

---

Made with love for arts communities
