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
### Option 1: Using Docker 
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

### Option 2: Running Natively with Supabase (Recommended)
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
### Generate Prisma client
- npx prisma generate
### Push schema changes
- npx prisma db push
### Run migrations
- npx prisma migrate dev
### Seed database
- npx prisma db seed
###  Then
- npm run dev

- Click the environment dropdown (top right)
- Select "Digital Asset API - Local"
and give me comlete code

## Importing the Collection

### Step 1: Import Collection
1. Open Postman
2. Click "Import" button (top left)
3. Select "File" tab
4. Choose `Postman_Collection.postman_collection.json` from your project root
5. Click "Import"

### Step 2: Create Environment
1. Click on "Environments" in the left sidebar
2. Click "Create Environment"
3. Name it "Digital Asset API - Local"
4. Add the following variables:

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3000` | API base URL |
| `user_token` | `` | JWT token for regular user (auto-filled) |
| `admin_token` | `` | JWT token for admin user |
| `user_id` | `` | Current user ID (auto-filled) |
| `asset_id` | `` | ID of uploaded asset for testing |
| `target_user_id` | `` | User ID for admin operations |
| `webhook_subscription_id` | `` | Webhook subscription ID |
| `test_user_email` | `test@example.com` | Test user email |
| `test_user_password` | `password123` | Test user password |
| `test_user_firstname` | `Test` | Test user first name |
| `test_user_lastname` | `User` | Test user last name |
| `google_test_email` | `google@example.com` | Google OAuth test email |
| `google_test_name` | `Google Test User` | Google OAuth test name |
| `google_test_id` | `google-123456` | Google OAuth test ID |
| `google_test_picture` | `https://example.com/avatar.jpg` | Google OAuth test picture |
| `share_email` | `share@example.com` | Email for asset sharing |
| `share_expiry` | `2024-12-31T23:59:59Z` | Asset share expiry date |
| `webhook_test_url` | `https://webhook.site/test` | Test webhook URL |
| `webhook_secret` | `your-webhook-secret` | Webhook secret key |

### Step 3: Select Environment
- Click the environment dropdown (top right)
- Select "Digital Asset API - Local"


# Thank you.