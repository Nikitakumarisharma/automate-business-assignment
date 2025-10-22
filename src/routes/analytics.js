const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken, requireAdmin, requireUserOrAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/admin/overview
// @desc    Get admin analytics overview
// @access  Private (Admin)
router.get('/admin/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total users
    const totalUsers = await prisma.user.count();

    // Get active users (logged in within period)
    const activeUsers = await prisma.user.count({
      where: { lastLogin: { gte: startDate } }
    });

    // Get total assets
    const totalAssets = await prisma.asset.count();

    // Get total storage used
    const assets = await prisma.asset.findMany({
      select: { fileSize: true }
    });

    const totalStorage = assets.reduce((sum, asset) => sum + Number(asset.fileSize), 0);

    // Get recent uploads
    const recentUploads = await prisma.asset.count({
      where: { createdAt: { gte: startDate } }
    });

    // Get most active users
    const userActivity = await prisma.$queryRaw`
      SELECT "user_id", COUNT(*) as "activityCount", "user_email"
      FROM "activity_logs"
      WHERE "timestamp" >= ${startDate} AND "action" IN ('upload', 'download', 'view', 'share')
      GROUP BY "user_id", "user_email"
      ORDER BY "activityCount" DESC
      LIMIT 10
    `;

    // Get asset type distribution
    const assetTypes = await prisma.asset.findMany({
      select: { mimeType: true }
    });

    const typeDistribution = {};
    assetTypes.forEach(asset => {
      const type = asset.mimeType.split('/')[0];
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          totalAssets,
          totalStorage,
          recentUploads
        },
        mostActiveUsers: userActivity,
        assetTypeDistribution: typeDistribution,
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/analytics/admin/storage
// @desc    Get storage usage analytics
// @access  Private (Admin)
router.get('/admin/storage', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get storage usage by user
    const userStorage = await prisma.asset.findMany({
      select: {
        ownerId: true,
        fileSize: true,
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

    const storageByUser = {};
    userStorage.forEach(asset => {
      const userId = asset.ownerId;
      if (!storageByUser[userId]) {
        storageByUser[userId] = {
          userId,
          user: asset.owner,
          totalSize: 0,
          assetCount: 0
        };
      }
      storageByUser[userId].totalSize += Number(asset.fileSize);
      storageByUser[userId].assetCount += 1;
    });

    const sortedUsers = Object.values(storageByUser)
      .sort((a, b) => b.totalSize - a.totalSize)
      .slice(0, 20);

    // Get storage usage by file type
    const assets = await prisma.asset.findMany({
      select: { mimeType: true, fileSize: true }
    });

    const storageByType = {};
    assets.forEach(asset => {
      const type = asset.mimeType.split('/')[0];
      if (!storageByType[type]) {
        storageByType[type] = {
          type,
          totalSize: 0,
          count: 0
        };
      }
      storageByType[type].totalSize += Number(asset.fileSize);
      storageByType[type].count += 1;
    });

    res.json({
      success: true,
      data: {
        storageByUser: sortedUsers,
        storageByType: Object.values(storageByType)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/analytics/admin/activity
// @desc    Get system activity analytics
// @access  Private (Admin)
router.get('/admin/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '7d', action } = req.query;
    const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const where = { timestamp: { gte: startDate } };
    if (action) {
      where.action = action;
    }

    // Get activity timeline
    const timeline = await prisma.$queryRaw`
      SELECT DATE("timestamp") as date, "action", COUNT(*) as count
      FROM "activity_logs"
      WHERE "timestamp" >= ${startDate} ${action ? `AND "action" = ${action}` : ''}
      GROUP BY DATE("timestamp"), "action"
      ORDER BY DATE("timestamp"), "action"
    `;

    // Get top actions
    const topActions = await prisma.activityLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 10
    });

    // Get failed actions
    const failedActions = await prisma.activityLog.groupBy({
      by: ['action'],
      where: { ...where, success: false },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } }
    });

    res.json({
      success: true,
      data: {
        timeline,
        topActions: topActions.map(item => ({ _id: item.action, count: item._count.action })),
        failedActions: failedActions.map(item => ({ _id: item.action, count: item._count.action })),
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/analytics/user/overview
// @desc    Get user analytics overview
// @access  Private (User/Admin)
router.get('/user/overview', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's assets
    const userAssets = await prisma.asset.findMany({
      where: { ownerId: userId }
    });

    const totalAssets = userAssets.length;
    const totalStorage = userAssets.reduce((sum, asset) => sum + Number(asset.fileSize), 0);

    // Get recent uploads
    const recentUploads = userAssets.filter(asset =>
      asset.createdAt >= startDate
    ).length;

    // Get asset type distribution
    const typeDistribution = {};
    userAssets.forEach(asset => {
      const type = asset.mimeType.split('/')[0];
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });

    // Get user's activity
    const userActivity = await prisma.activityLog.findMany({
      where: {
        userId,
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    // Get download count
    const totalDownloads = userAssets.reduce((sum, asset) => sum + asset.downloadCount, 0);

    res.json({
      success: true,
      data: {
        overview: {
          totalAssets,
          totalStorage,
          recentUploads,
          totalDownloads
        },
        assetTypeDistribution: typeDistribution,
        recentActivity: userActivity,
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/analytics/user/storage
// @desc    Get user storage analytics
// @access  Private (User/Admin)
router.get('/user/storage', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's assets with storage info
    const assets = await prisma.asset.findMany({
      where: { ownerId: userId },
      select: { mimeType: true, fileSize: true, createdAt: true }
    });

    // Group by file type
    const storageByType = {};
    assets.forEach(asset => {
      const type = asset.mimeType.split('/')[0];
      if (!storageByType[type]) {
        storageByType[type] = {
          type,
          totalSize: 0,
          count: 0
        };
      }
      storageByType[type].totalSize += Number(asset.fileSize);
      storageByType[type].count += 1;
    });

    // Get storage usage over time (last 30 days)
    const storageOverTime = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayAssets = assets.filter(asset => {
        const assetDate = new Date(asset.createdAt);
        return assetDate <= dayEnd;
      });

      const dayStorage = dayAssets.reduce((sum, asset) => sum + Number(asset.fileSize), 0);

      storageOverTime.unshift({
        date: dayStart.toISOString().split('T')[0],
        storage: dayStorage,
        count: dayAssets.length
      });
    }

    res.json({
      success: true,
      data: {
        storageByType: Object.values(storageByType),
        storageOverTime,
        totalStorage: assets.reduce((sum, asset) => sum + Number(asset.fileSize), 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/analytics/user/activity
// @desc    Get user activity timeline
// @access  Private (User/Admin)
router.get('/user/activity', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { period = '7d', limit = 50 } = req.query;
    const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's recent activity
    const activities = await prisma.activityLog.findMany({
      where: {
        userId,
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit)
    });

    // Get activity summary
    const activitySummary = await prisma.activityLog.groupBy({
      by: ['action'],
      where: {
        userId,
        timestamp: { gte: startDate }
      },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } }
    });

    res.json({
      success: true,
      data: {
        activities,
        summary: activitySummary.map(item => ({ _id: item.action, count: item._count.action })),
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
