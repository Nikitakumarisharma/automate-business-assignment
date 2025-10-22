const express = require('express');
const { body, validationResult } = require('express-validator');
const AssetService = require('../services/AssetService');
const { upload } = require('../services/S3Service');
const { authenticateToken, requireAdmin, requireUserOrAdmin, requireOwnershipOrAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const AuthService = require('../services/AuthService');

const router = express.Router();
const assetService = new AssetService();

// @route   POST /api/assets
// @desc    Upload a new asset
// @access  Private (User/Admin)
router.post('/', authenticateToken, requireUserOrAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { tags, description, isPublic } = req.body;
    const userId = req.user.userId;

    const metadata = {
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      description: description || '',
      is_public: isPublic === 'true'
    };

    const asset = await assetService.uploadAsset(req.file, userId, metadata);

    // Log activity with proper request info
    await AuthService.logActivity(
      userId,
      req.user.email,
      'upload',
      'asset',
      asset.id,
      {
        filename: asset.original_filename,
        fileSize: asset.file_size,
        mimeType: asset.mime_type
      },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Asset uploaded successfully',
      data: asset
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/assets
// @desc    Get user's assets
// @access  Private (User/Admin)
router.get('/', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page, limit, sortBy, sortOrder, tags, mimeType } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      tags: tags ? tags.split(',') : undefined,
      mimeType
    };

    const assets = await assetService.getUserAssets(userId, options);

    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/assets/all
// @desc    Get all assets (admin only)
// @access  Private (Admin)
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder, userId, tags, mimeType } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      userId,
      tags: tags ? tags.split(',') : undefined,
      mimeType
    };

    const assets = await assetService.getAllAssets(options);

    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/assets/:id
// @desc    Get asset by ID
// @access  Private (User/Admin) or Public if shared
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const assetId = req.params.id;
    const userId = req.user.userId;

    const asset = await assetService.getAssetById(assetId, userId);

    // Log view activity
    await AuthService.logActivity(
      userId,
      req.user.email,
      'view',
      'asset',
      assetId,
      { filename: asset.original_filename },
      req
    );

    res.json({
      success: true,
      data: asset
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/assets/shared/:id
// @desc    Get shared asset (public access)
// @access  Public
router.get('/shared/:id', async (req, res) => {
  try {
    const assetId = req.params.id;

    const asset = await assetService.getAssetById(assetId);

    res.json({
      success: true,
      data: asset
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/assets/:id
// @desc    Update asset metadata
// @access  Private (Owner/Admin)
router.put('/:id', authenticateToken, requireUserOrAdmin, [
  body('tags').optional().isArray(),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('isPublic').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    const assetId = req.params.id;
    const userId = req.user.userId;
    const isAdmin = req.user.roles.includes('admin');

    // Check ownership (admin can update any asset)
    if (!isAdmin) {
      const { supabase } = require('../config/supabase');
      const { data: asset } = await supabase
        .from('assets')
        .select('owner_id')
        .eq('id', assetId)
        .single();

      if (!asset || asset.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const updateData = {
      tags: req.body.tags,
      description: req.body.description,
      is_public: req.body.isPublic,
      metadata: req.body.metadata
    };

    const updatedAsset = await assetService.updateAsset(assetId, userId, updateData);

    res.json({
      success: true,
      message: 'Asset updated successfully',
      data: updatedAsset
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/assets/:id
// @desc    Delete asset
// @access  Private (Owner/Admin)
router.delete('/:id', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const assetId = req.params.id;
    const userId = req.user.userId;
    const isAdmin = req.user.roles.includes('admin');

    await assetService.deleteAsset(assetId, userId, isAdmin);

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/assets/:id/share
// @desc    Share asset with another user
// @access  Private (Owner/Admin)
router.post('/:id/share', authenticateToken, requireUserOrAdmin, [
  body('email').optional().isEmail(),
  body('userId').optional().isUUID(),
  body('accessLevel').optional().isIn(['view', 'download']),
  body('expiresAt').optional().isISO8601()
], validateRequest, async (req, res) => {
  try {
    const assetId = req.params.id;
    const userId = req.user.userId;
    const { email, userId: targetUserId, accessLevel, expiresAt } = req.body;

    if (!email && !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Either email or userId is required'
      });
    }

    const shareData = {
      email,
      userId: targetUserId,
      accessLevel,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    };

    const share = await assetService.shareAsset(assetId, userId, shareData);

    res.status(201).json({
      success: true,
      message: 'Asset shared successfully',
      data: share
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/assets/:id/download
// @desc    Generate download URL for asset
// @access  Private (Owner/Shared/Admin) or Public if public
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const assetId = req.params.id;
    const userId = req.user.userId;

    const downloadData = await assetService.generateDownloadUrl(assetId, userId);

    res.json({
      success: true,
      data: downloadData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
