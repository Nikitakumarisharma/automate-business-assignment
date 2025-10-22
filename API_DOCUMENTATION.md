# Digital Asset Management API

## Overview
This API provides comprehensive digital asset management with role-based access control, cloud storage integration, and webhook notifications.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Error Responses
All error responses follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Optional validation errors
}
```

## Success Responses
All success responses follow this format:
```json
{
  "success": true,
  "message": "Success message",
  "data": {} // Response data
}
```

## Rate Limiting
- API requests: 100 requests per 15 minutes per IP
- File uploads: 5 requests per 15 minutes per IP
- Rate limit headers are included in responses

## Pagination
List endpoints support pagination with these query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `sortBy`: Field to sort by
- `sortOrder`: Sort direction (asc/desc)

## File Upload
- Maximum file size: 100MB
- Supported formats: Images, PDFs, Documents, Text files
- Images are automatically optimized and resized

## Webhooks
- Events are sent as POST requests to registered URLs
- Include signature verification headers
- Retry failed deliveries with exponential backoff

## Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error
