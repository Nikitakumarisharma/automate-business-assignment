const AWS = require('aws-sdk');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

class S3Service {
  constructor() {
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB
    this.allowedMimeTypes = (process.env.ALLOWED_FILE_TYPES || '').split(',');
  }

  // Upload file to S3
  async uploadFile(file, userId, metadata = {}) {
    try {
      const fileExtension = this.getFileExtension(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `assets/${userId}/${fileName}`;

      // Process image files (resize if needed)
      let fileBuffer = file.buffer;
      if (this.isImageFile(file.mimetype)) {
        fileBuffer = await this.processImage(file.buffer, file.mimetype);
      }

      // Helper function to recursively convert BigInt to string
      const convertBigIntToString = (obj) => {
        if (typeof obj === 'bigint') {
          return obj.toString();
        } else if (Array.isArray(obj)) {
          return obj.map(convertBigIntToString);
        } else if (obj !== null && typeof obj === 'object') {
          const result = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = convertBigIntToString(value);
          }
          return result;
        }
        return obj;
      };

      // Convert metadata values to strings as required by S3
      const stringifiedMetadata = {};
      for (const [key, value] of Object.entries(metadata)) {
        stringifiedMetadata[key] = JSON.stringify(convertBigIntToString(value));
      }

      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          ...stringifiedMetadata
        }
      };

      const result = await s3.upload(uploadParams).promise();

      return {
        s3Key,
        s3Url: result.Location,
        fileName,
        originalName: file.originalname,
        fileSize: fileBuffer.length,
        mimeType: file.mimetype,
        fileExtension
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  // Delete file from S3
  async deleteFile(s3Key) {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      await s3.deleteObject(deleteParams).promise();
      return true;
    } catch (error) {
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  // Generate signed URL for file access
  async generateSignedUrl(s3Key, expiresIn = 3600) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: expiresIn
      };

      return s3.getSignedUrl('getObject', params);
    } catch (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  // Get file metadata from S3
  async getFileMetadata(s3Key) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const result = await s3.headObject(params).promise();
      return {
        size: result.ContentLength,
        mimeType: result.ContentType,
        lastModified: result.LastModified,
        metadata: result.Metadata
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  // Process image files (resize, optimize)
  async processImage(buffer, mimeType) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Resize if image is too large (max 2048px on longest side)
      if (metadata.width > 2048 || metadata.height > 2048) {
        image.resize(2048, 2048, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert to appropriate format
      if (mimeType === 'image/jpeg') {
        return image.jpeg({ quality: 85 }).toBuffer();
      } else if (mimeType === 'image/png') {
        return image.png({ compressionLevel: 8 }).toBuffer();
      } else if (mimeType === 'image/webp') {
        return image.webp({ quality: 85 }).toBuffer();
      }

      return buffer;
    } catch (error) {
      console.error('Image processing failed:', error);
      return buffer; // Return original buffer if processing fails
    }
  }

  // Check if file type is allowed
  isAllowedFileType(mimeType) {
    return this.allowedMimeTypes.length === 0 || this.allowedMimeTypes.includes(mimeType);
  }

  // Check if file is an image
  isImageFile(mimeType) {
    return mimeType.startsWith('image/');
  }

  // Get file extension
  getFileExtension(filename) {
    return filename.substring(filename.lastIndexOf('.'));
  }

  // Validate file
  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return errors;
    }

    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    if (!this.isAllowedFileType(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    return errors;
  }
}

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const s3Service = new S3Service();
  
  if (s3Service.isAllowedFileType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB
  }
});

module.exports = {
  S3Service,
  upload
};
