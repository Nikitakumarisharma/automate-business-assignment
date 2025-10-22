# Digital Asset Management API

A comprehensive Digital Asset Management & Notification System with Role-Based Access Control (RBAC), built with Node.js, Express, Prisma, Supabase, and AWS S3.

## Features

- **User Authentication & Authorization**: JWT-based auth with role-based access control
- **Asset Management**: Upload, store, and manage digital assets (images, documents, etc.)
- **AWS S3 Integration**: Secure cloud storage for assets
- **Supabase Integration**: Real-time database and authentication
- **Webhook Notifications**: Automated notifications for asset events
- **Rate Limiting**: Protection against abuse
- **Comprehensive Logging**: MongoDB-based logging system
- **Docker Support**: Easy deployment with Docker Compose

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Docker and Docker Compose (for full environment setup)
- Supabase account (for database and auth)
- AWS account (for S3 storage)

## Quick Start

### Option 1: Using Docker (Recommended)

1. **Clone the repository** and navigate to the project directory.

2. **Set up environment variables**:
   ```bash
   cp env.example .env
   ```
   Edit `.env` with your Supabase and AWS credentials.

3. **Run with Docker Compose**:
   ```bash
   # For development (includes database management tools)
   docker-compose -f docker-compose.dev.yml up --build

   # For production-like setup
   docker-compose up --build
   ```

4. **Access the application**:
   - API: http://localhost:3000
   - pgAdmin (dev): http://localhost:5050 (admin@example.com / admin)
   - MongoDB Express (dev): http://localhost:8081 (admin / admin)

### Option 2: Running Natively with Supabase

Since you've set up directly with Supabase, you can run the app natively without Docker for databases.

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp env.example .env
   ```
   Configure your `.env` file with:
   - Supabase URL and anon key
   - AWS S3 credentials
   - JWT secret
   - Other required variables

# Generate Prisma client

npx prisma generate

# Push schema changes

npx prisma db push

# Run migrations

npx prisma migrate dev

# Seed database

npx prisma db seed

#  then
npm run dev

