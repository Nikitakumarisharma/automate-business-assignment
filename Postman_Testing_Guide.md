# Digital Asset Management API - Postman Testing Guide

## Overview
This guide provides comprehensive instructions for testing the Digital Asset Management API using Postman. The collection includes all endpoints organized by functionality with pre-configured requests, authentication handling, and test data.

## Prerequisites

### 1. Postman Installation
- Download and install Postman from [postman.com](https://www.postman.com/downloads/)
- Create a free account or sign in

### 2. API Server Setup
Ensure your API server is running locally:
```bash
# Start the development server
npm run dev
# Server should be running on http://localhost:3000
```

### 3. Database Setup
Make sure your databases are set up and seeded:
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed
```

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

## Testing Workflow

### 1. Health Check
Start by verifying the API is running:
- Run "Health Check" request
- Should return 200 OK with server status

### 2. User Registration & Authentication

#### Register a New User
1. Go to "Authentication" folder
2. Run "Register User"
3. Verify successful registration (201 status)
4. Note: User tokens are automatically saved to environment variables

#### Login
1. Run "Login User"
2. Token is automatically saved to `user_token`
3. User ID is saved to `user_id`

#### Get User Profile
1. Run "Get Current User Profile"
2. Verify user information is returned correctly

### 3. Asset Management Testing

#### Upload an Asset
1. Go to "Asset Management" folder
2. Select "Upload Asset"
3. In the Body tab, select a file for the "file" field
4. Add description and tags if desired
5. Run the request
6. Copy the returned asset ID to `asset_id` environment variable

#### Test Asset Operations
1. **Get User Assets**: Lists all your assets
2. **Get Asset by ID**: Use the `asset_id` from upload
3. **Update Asset Metadata**: Modify description/tags
4. **Generate Download URL**: Get secure download link
5. **Share Asset**: Share with another email
6. **Delete Asset**: Remove the test asset

### 4. Admin Operations (if you have admin access)

#### Get Admin Token
- You'll need to login with an admin account or promote a user to admin
- Set the admin token in `admin_token` environment variable

#### User Management
1. **Get All Users**: View all system users
2. **Get User by ID**: Get specific user details
3. **Update User**: Modify user roles/status
4. **Get User's Assets**: View another user's assets
5. **Get User's Activity**: View user activity logs

### 5. Analytics Testing

#### User Analytics
1. **User Overview Analytics**: Personal dashboard data
2. **User Storage Analytics**: Storage usage breakdown
3. **User Activity Analytics**: Personal activity timeline

#### Admin Analytics (requires admin token)
1. **Admin Overview Analytics**: System-wide statistics
2. **Admin Storage Analytics**: All users' storage usage
3. **Admin Activity Analytics**: System activity monitoring

### 6. Webhook Testing

#### Setup Webhooks
1. **Subscribe to Webhooks**: Create webhook subscription
2. Copy subscription ID to `webhook_subscription_id`
3. **Get Webhook Subscriptions**: List your subscriptions
4. **Test Webhook**: Send test event to your endpoint

#### Webhook Management
1. **Update Webhook Subscription**: Modify subscription settings
2. **Get Webhook Events**: View event history
3. **Get Webhook Stats**: Delivery statistics
4. **Delete Webhook Subscription**: Remove subscription

## Test Data Examples

### Sample User Registration
```json
{
  "email": "test@example.com",
  "password": "password123",
  "firstName": "Test",
  "lastName": "User"
}
```

### Sample Asset Upload
- **File**: Choose any image/document file
- **Description**: "Test asset for API testing"
- **Tags**: "test,api,demo"
- **isPublic**: false

### Sample Webhook Subscription
```json
{
  "webhookUrl": "https://webhook.site/your-unique-id",
  "events": ["asset.uploaded", "asset.deleted", "asset.shared"],
  "secretKey": "your-secret-key"
}