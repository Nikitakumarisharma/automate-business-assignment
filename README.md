# Digital Asset Management & Notification System

A comprehensive backend system for managing and sharing digital assets with role-based access control, cloud storage integration, and webhook notifications.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication
  - Email/password and Google OAuth login
  - Role-based access control (Admin, User, Viewer)
  - Secure API route protection

- **Asset Management**
  - Upload digital assets to AWS S3
  - Store metadata in PostgreSQL
  - File type validation and processing
  - Image optimization with Sharp
  - Asset sharing and permissions

- **Webhook System**
  - Event-driven notifications
  - Retry mechanisms with exponential backoff
  - Secure webhook signatures
  - Real-time event processing

- **Analytics Dashboard**
  - User and admin analytics
  - Storage usage tracking
  - Activity monitoring
  - Performance metrics

- **Activity Logging**
  - MongoDB-based activity logs
  - Comprehensive audit trail
  - User action tracking
  - System monitoring

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Supabase), MongoDB
- **Cloud Storage**: AWS S3
- **Authentication**: JWT, Google OAuth
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Testing**: Jest, Supertest
- **Code Quality**: ESLint, Prettier

## 📋 Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- AWS Account with S3 bucket
- Supabase Account
- MongoDB instance
- Google OAuth credentials (optional)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd digital-asset-management-api
```

### 2. Environment Setup

Copy the environment template and configure your variables:

```bash
cp env.example .env
```

Update `.env` with your configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/digital_asset_db

# Supabase Configuration
SUPABASE_URL=https://ulfitkdteviualcoaksl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZml0a2R0ZXZpdWFsY29ha3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjIzODQsImV4cCI6MjA3NjYzODM4NH0.yX_ZJ8Td5sBnDFlEmjr3erufPnUzR_CfwLMngtRefJw

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-s3-bucket-name

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Server Configuration
PORT=3000
NODE_ENV=development

# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret_key
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_RETRY_DELAY=1000
```

### 3. Database Setup

#### PostgreSQL with Prisma
1. Set up a PostgreSQL database (local or cloud)
2. Update `DATABASE_URL` in `.env` with your PostgreSQL connection string
3. Generate Prisma client and run migrations:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

#### MongoDB
1. Set up a MongoDB instance (local or cloud)
2. Update `MONGODB_URI` in `.env`

### 4. AWS S3 Setup
1. Create an S3 bucket
2. Configure IAM user with S3 permissions
3. Update AWS credentials in `.env`

### 5. Run with Docker (Recommended)

```bash
# Development environment
docker-compose -f docker-compose.dev.yml up -d

# Production environment
docker-compose up -d
```

### 6. Run Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

## 🧪 Testing with Postman

This project includes a Postman collection for testing all API endpoints. To import and use it:

1. **Open Postman** on your computer.
2. **Click on "Import"** button in the top left corner.
3. **Select "File"** tab in the import dialog.
4. **Choose the file** `Postman_Collection.postman_collection.json` from the project root directory.
5. **Click "Import"** to load the collection.
6. **Set up environment variables** in Postman:
   - Create a new environment in Postman.
   - Add variables like `base_url` (e.g., `http://localhost:3000`), `token` (for authenticated requests), etc.
7. **Start testing** the endpoints using the imported collection.

The collection includes all authentication, asset management, user management, analytics, and webhook endpoints with pre-configured requests.

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Google OAuth
```http
POST /api/auth/google
Content-Type: application/json

{
  "email": "user@gmail.com",
  "name": "John Doe",
  "googleId": "google_user_id",
  "picture": "https://avatar.url"
}
```

### Asset Management Endpoints

#### Upload Asset
```http
POST /api/assets
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
description: "Asset description"
tags: "tag1,tag2"
isPublic: false
```

#### Get User Assets
```http
GET /api/assets?page=1&limit=20&sortBy=created_at&sortOrder=desc
Authorization: Bearer <token>
```

#### Get Asset by ID
```http
GET /api/assets/:id
Authorization: Bearer <token>
```

#### Update Asset
```http
PUT /api/assets/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated description",
  "tags": ["tag1", "tag2"],
  "isPublic": true
}
```

#### Delete Asset
```http
DELETE /api/assets/:id
Authorization: Bearer <token>
```

#### Share Asset
```http
POST /api/assets/:id/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "recipient@example.com",
  "accessLevel": "view",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

#### Download Asset
```http
GET /api/assets/:id/download
Authorization: Bearer <token>
```

### User Management Endpoints (Admin Only)

#### Get All Users
```http
GET /api/users?page=1&limit=20&search=john
Authorization: Bearer <admin_token>
```

#### Get User by ID
```http
GET /api/users/:id
Authorization: Bearer <admin_token>
```

#### Update User
```http
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "firstName": "Updated Name",
  "isActive": true,
  "roles": ["user", "admin"]
}
```

#### Delete User
```http
DELETE /api/users/:id
Authorization: Bearer <admin_token>
```

### Analytics Endpoints

#### User Analytics
```http
GET /api/analytics/user/overview?period=30d
Authorization: Bearer <token>
```

#### Admin Analytics
```http
GET /api/analytics/admin/overview?period=30d
Authorization: Bearer <admin_token>
```

#### Storage Analytics
```http
GET /api/analytics/user/storage
Authorization: Bearer <token>
```

### Webhook Endpoints

#### Subscribe to Webhooks
```http
POST /api/webhooks/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "webhookUrl": "https://your-webhook-endpoint.com",
  "events": ["asset.uploaded", "asset.deleted"],
  "secretKey": "optional_secret"
}
```

#### Get Webhook Subscriptions
```http
GET /api/webhooks/subscriptions
Authorization: Bearer <token>
```

#### Test Webhook
```http
POST /api/webhooks/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "webhookUrl": "https://webhook.site/test"
}
```

## 🔐 Role-Based Access Control

### Roles

- **Admin**: Full system access
  - Manage all users
  - View all assets
  - Access admin analytics
  - System configuration

- **User**: Asset management
  - Upload/manage own assets
  - Share assets
  - View personal analytics

- **Viewer**: Read-only access
  - View shared assets only
  - Download shared assets

### Permission Matrix

| Action | Admin | User | Viewer |
|--------|-------|------|--------|
| Upload Assets | ✅ | ✅ | ❌ |
| View Own Assets | ✅ | ✅ | ❌ |
| View All Assets | ✅ | ❌ | ❌ |
| Delete Own Assets | ✅ | ✅ | ❌ |
| Delete Any Assets | ✅ | ❌ | ❌ |
| Share Assets | ✅ | ✅ | ❌ |
| View Shared Assets | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ❌ |
| Admin Analytics | ✅ | ❌ | ❌ |

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Structure
```
tests/
├── api.test.js          # API endpoint tests
├── auth.test.js         # Authentication tests
├── assets.test.js       # Asset management tests
├── analytics.test.js    # Analytics tests
└── webhooks.test.js     # Webhook tests
```

## 🚀 Deployment

### AWS EC2 Deployment

1. **Setup EC2 Instance**
   ```bash
   # Install Docker
   sudo apt update
   sudo apt install docker.io docker-compose
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

2. **Configure GitHub Secrets**
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `EC2_HOST`
   - `EC2_USERNAME`
   - `EC2_SSH_KEY`
   - `DATABASE_URL`
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `WEBHOOK_SECRET`

3. **Deploy via GitHub Actions**
   - Push to `main` branch
   - GitHub Actions will automatically deploy

### Manual Deployment

```bash
# Build Docker image
docker build -t digital-asset-api .

# Run container
docker run -d \
  --name digital-asset-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="your_db_url" \
  -e MONGODB_URI="your_mongo_url" \
  -e JWT_SECRET="your_jwt_secret" \
  -e AWS_ACCESS_KEY_ID="your_aws_key" \
  -e AWS_SECRET_ACCESS_KEY="your_aws_secret" \
  -e AWS_S3_BUCKET_NAME="your_bucket" \
  digital-asset-api
```

## 📊 Monitoring & Logging

### Health Check
```http
GET /health
```

### Activity Logs
- All user actions are logged to MongoDB
- Includes IP address, user agent, and timestamps
- Searchable by user, action type, and date range

### Webhook Events
- Real-time event processing
- Retry mechanism for failed deliveries
- Comprehensive event history

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment | No | development |
| `DATABASE_URL` | PostgreSQL connection | Yes | - |
| `MONGODB_URI` | MongoDB connection | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | Yes | - |
| `MAX_FILE_SIZE` | Max upload size | No | 100MB |
| `WEBHOOK_RETRY_ATTEMPTS` | Max retry attempts | No | 3 |

### File Upload Limits

- **Max file size**: 100MB (configurable)
- **Allowed types**: Images, PDFs, Documents, Text files
- **Image processing**: Automatic optimization and resizing

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: API request throttling
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CORS Configuration**: Cross-origin request control
- **Helmet.js**: Security headers
- **Webhook Signatures**: HMAC verification

## 📈 Performance

- **Image Optimization**: Sharp.js for image processing
- **Database Indexing**: Optimized queries
- **Caching**: Redis integration (optional)
- **CDN Ready**: S3 integration for asset delivery
- **Horizontal Scaling**: Docker containerization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the test files for usage examples

## 🔄 Changelog

### v1.0.0
- Initial release
- Complete asset management system
- Role-based access control
- Webhook notifications
- Analytics dashboard
- Docker deployment
- CI/CD pipeline
#   a u t o m a t e - b u s i n e s s - a s s i g n m e n t 
 
 
