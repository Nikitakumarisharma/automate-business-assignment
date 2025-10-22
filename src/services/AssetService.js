const prisma = require('../config/prisma');
const { S3Service } = require('./S3Service');

class AssetService {
  constructor() {
    this.s3Service = new S3Service();
  }

  // Upload asset
  async uploadAsset(file, userId, metadata = {}) {
    try {
      // Validate file
      const validationErrors = this.s3Service.validateFile(file);
      if (validationErrors.length > 0) {
        throw new Error(`File validation failed: ${validationErrors.join(', ')}`);
      }

      // Upload to S3
      const s3Result = await this.s3Service.uploadFile(file, userId, metadata);

      // Save asset metadata to database
      const asset = await prisma.asset.create({
        data: {
          filename: s3Result.fileName,
          originalFilename: s3Result.originalName,
          fileSize: s3Result.fileSize,
          mimeType: s3Result.mimeType,
          fileExtension: s3Result.fileExtension,
          s3Key: s3Result.s3Key,
          s3Bucket: this.s3Service.bucketName,
          s3Url: s3Result.s3Url,
          ownerId: userId,
          tags: metadata.tags || [],
          description: metadata.description || '',
          metadata: {
            uploadedAt: new Date().toISOString(),
            ...metadata
          }
        }
      });

      // Log activity
      await this.logActivity(userId, 'upload', 'asset', asset.id, {
        filename: asset.originalFilename,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType
      });

      // Trigger webhook
      await this.triggerWebhook('asset.uploaded', {
        assetId: asset.id,
        userId,
        filename: asset.originalFilename,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType
      });

      return asset;
    } catch (error) {
      throw error;
    }
  }

  // Get user's assets
  async getUserAssets(userId, options = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', tags, mimeType } = options;
      const skip = (page - 1) * limit;

      const where = {
        ownerId: userId
      };

      if (tags && tags.length > 0) {
        where.tags = {
          hasSome: tags
        };
      }

      if (mimeType) {
        where.mimeType = mimeType;
      }

      const assets = await prisma.asset.findMany({
        where,
        orderBy: {
          [sortBy === 'created_at' ? 'createdAt' : sortBy]: sortOrder
        },
        skip,
        take: limit
      });

      return assets;
    } catch (error) {
      throw error;
    }
  }

  // Get all assets (admin only)
  async getAllAssets(options = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', userId, tags, mimeType } = options;
      const skip = (page - 1) * limit;

      const where = {};

      if (userId) {
        where.ownerId = userId;
      }

      if (tags && tags.length > 0) {
        where.tags = {
          hasSome: tags
        };
      }

      if (mimeType) {
        where.mimeType = mimeType;
      }

      const assets = await prisma.asset.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          [sortBy === 'created_at' ? 'createdAt' : sortBy]: sortOrder
        },
        skip,
        take: limit
      });

      return assets;
    } catch (error) {
      throw error;
    }
  }

  // Get asset by ID
  async getAssetById(assetId, userId = null) {
    try {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Check access permissions
      if (userId && asset.ownerId !== userId && !asset.isPublic) {
        // Check if asset is shared with user
        const share = await prisma.assetShare.findFirst({
          where: {
            assetId,
            isActive: true,
            OR: [
              { sharedWithUserId: userId },
              { sharedWithEmail: asset.owner.email }
            ]
          }
        });

        if (!share) {
          throw new Error('Access denied');
        }
      }

      return asset;
    } catch (error) {
      throw error;
    }
  }

  // Update asset metadata
  async updateAsset(assetId, userId, updateData) {
    try {
      // Check ownership
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { ownerId: true }
      });

      if (!asset || asset.ownerId !== userId) {
        throw new Error('Access denied');
      }

      const updatedAsset = await prisma.asset.update({
        where: { id: assetId },
        data: {
          tags: updateData.tags,
          description: updateData.description,
          isPublic: updateData.is_public,
          metadata: updateData.metadata,
          updatedAt: new Date()
        }
      });

      // Log activity
      await this.logActivity(userId, 'update', 'asset', assetId, updateData);

      // Trigger webhook
      await this.triggerWebhook('asset.updated', {
        assetId,
        userId,
        updateData
      });

      return updatedAsset;
    } catch (error) {
      throw error;
    }
  }

  // Delete asset
  async deleteAsset(assetId, userId, isAdmin = false) {
    try {
      // Check ownership or admin access
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { ownerId: true, s3Key: true }
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      if (!isAdmin && asset.ownerId !== userId) {
        throw new Error('Access denied');
      }

      // Delete from S3
      await this.s3Service.deleteFile(asset.s3Key);

      // Delete from database
      await prisma.asset.delete({
        where: { id: assetId }
      });

      // Log activity
      await this.logActivity(userId, 'delete', 'asset', assetId, {
        deletedBy: isAdmin ? 'admin' : 'owner'
      });

      // Trigger webhook
      await this.triggerWebhook('asset.deleted', {
        assetId,
        userId,
        deletedBy: isAdmin ? 'admin' : 'owner'
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Share asset
  async shareAsset(assetId, userId, shareData) {
    try {
      // Check ownership
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { ownerId: true }
      });

      if (!asset || asset.ownerId !== userId) {
        throw new Error('Access denied');
      }

      const share = await prisma.assetShare.create({
        data: {
          assetId,
          sharedBy: userId,
          sharedWithEmail: shareData.email,
          sharedWithUserId: shareData.userId,
          accessLevel: shareData.accessLevel || 'view',
          expiresAt: shareData.expiresAt,
          isActive: true
        }
      });

      // Log activity
      await this.logActivity(userId, 'share', 'asset', assetId, {
        sharedWith: shareData.email || shareData.userId,
        accessLevel: shareData.accessLevel
      });

      // Trigger webhook
      await this.triggerWebhook('asset.shared', {
        assetId,
        userId,
        sharedWith: shareData.email || shareData.userId,
        accessLevel: shareData.accessLevel
      });

      return share;
    } catch (error) {
      throw error;
    }
  }

  // Generate download URL
  async generateDownloadUrl(assetId, userId = null) {
    try {
      const asset = await this.getAssetById(assetId, userId);
      
      // Increment download count
      await prisma.asset.update({
        where: { id: assetId },
        data: { downloadCount: asset.downloadCount + 1 }
      });

      // Generate signed URL
      const signedUrl = await this.s3Service.generateSignedUrl(asset.s3Key, 3600); // 1 hour

      // Log activity
      await this.logActivity(userId || asset.ownerId, 'download', 'asset', assetId, {
        filename: asset.originalFilename
      });

      return {
        downloadUrl: signedUrl,
        filename: asset.originalFilename,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize
      };
    } catch (error) {
      throw error;
    }
  }

  // Log activity
  async logActivity(userId, action, resourceType, resourceId, details) {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          userEmail: '', // Will be filled by the route handler
          action,
          resourceType,
          resourceId,
          details,
          ipAddress: '127.0.0.1', // Will be filled by the route handler
          userAgent: 'API' // Will be filled by the route handler
        }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  // Trigger webhook
  async triggerWebhook(eventType, payload) {
    try {
      await prisma.webhookEvent.create({
        data: {
          eventType,
          payload,
          webhookUrl: process.env.WEBHOOK_URL || 'https://webhook.site/your-webhook-url',
          status: 'pending'
        }
      });
    } catch (error) {
      console.error('Failed to trigger webhook:', error);
    }
  }
}

module.exports = AssetService;