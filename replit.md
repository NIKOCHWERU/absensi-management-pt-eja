# Employee Attendance System

## Overview

This is a full-stack employee attendance management system built for Indonesian companies. The application allows employees to clock in/out with photo verification and geolocation, track their attendance history using a custom 26th-25th monthly cycle, and view company announcements. Administrators can manage employees and view attendance records.

The system features a mobile-first design with a React frontend and Express backend, using PostgreSQL for data persistence and Google Cloud Storage for file uploads.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom orange theme, mobile-first responsive design
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Passport.js with local strategy, session-based auth using express-session
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Password Security**: scrypt hashing with random salts

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - defines users, attendance, and announcements tables
- **Migrations**: Drizzle Kit for schema push (`npm run db:push`)
- **File Storage**: Google Cloud Storage via Replit Object Storage integration for photo uploads

### Key Design Patterns
- **Monorepo Structure**: Client code in `/client`, server in `/server`, shared types in `/shared`
- **Type Sharing**: Database schemas and API route definitions shared between frontend and backend
- **Presigned URL Uploads**: Two-step upload flow - request presigned URL, then upload directly to storage
- **Custom Date Logic**: Attendance periods run from 26th of previous month to 25th of current month (Indonesian payroll standard)

### Authentication Flow
- Dual login modes: Admin uses email, employees use NIK (employee ID number)
- Session cookies with secure settings in production
- Protected routes redirect unauthenticated users to login

### File Structure
```
├── client/src/
│   ├── components/     # UI components including shadcn/ui
│   ├── hooks/          # Custom React hooks (auth, attendance, uploads)
│   ├── pages/          # Route components (Dashboard, Recap, Info, Login)
│   └── lib/            # Utilities and query client
├── server/
│   ├── routes.ts       # API endpoint definitions
│   ├── storage.ts      # Database operations (implements IStorage interface)
│   ├── auth.ts         # Passport configuration
│   └── replit_integrations/  # Object storage service
└── shared/
    ├── schema.ts       # Drizzle database schema
    └── routes.ts       # API route definitions with Zod schemas
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Cloud Services
- **Google Cloud Storage**: File storage for attendance photos via Replit's Object Storage integration
- Accessed through the sidecar endpoint at `http://127.0.0.1:1106`

### Authentication
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **passport / passport-local**: Authentication middleware

### UI/Frontend Libraries
- **@radix-ui/***: Accessible UI primitives (dialogs, dropdowns, forms, etc.)
- **@tanstack/react-query**: Server state management and caching
- **@uppy/core + @uppy/aws-s3**: File upload handling with presigned URLs
- **date-fns**: Date manipulation for attendance calendar logic
- **framer-motion**: Animation library

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption (defaults to "attendance_secret" in dev)