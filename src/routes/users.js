const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const AuthService = require('../services/AuthService');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;

    const where = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                name: true,
                permissions: true
              }
            }
          }
        }
      },
      orderBy: {
        [sortBy === 'created_at' ? 'createdAt' : sortBy]: sortOrder
      },
      skip,
      take: parseInt(limit)
    });

    // Transform user data to include roles
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      roles: user.userRoles?.map(ur => ur.role.name) || []
    }));

    res.json({
      success: true,
      data: transformedUsers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only)
// @access  Private (Admin)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                name: true,
                permissions: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const transformedUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles?.map(ur => ur.role.name) || []
    };

    res.json({
      success: true,
      data: transformedUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (admin only)
// @access  Private (Admin)
router.put('/:id', authenticateToken, requireAdmin, [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('isVerified').optional().isBoolean(),
  body('roles').optional().isArray()
], validateRequest, async (req, res) => {
  try {
    const userId = req.params.id;
    const { firstName, lastName, isActive, isVerified, roles } = req.body;

    // Update user basic info
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    }

    // Update user roles if provided
    if (roles && Array.isArray(roles)) {
      // Remove existing roles
      await prisma.userRole.deleteMany({
        where: { userId }
      });

      // Add new roles
      if (roles.length > 0) {
        const roleData = await prisma.role.findMany({
          where: { name: { in: roles } },
          select: { id: true }
        });

        if (roleData && roleData.length > 0) {
          const userRoles = roleData.map(role => ({
            userId,
            roleId: role.id,
            assignedBy: req.user.userId
          }));

          await prisma.userRole.createMany({
            data: userRoles
          });
        }
      }
    }

    // Log activity
    await AuthService.logActivity(
      req.user.userId,
      req.user.email,
      'update',
      'user',
      userId,
      { updatedFields: Object.keys(updateData), roles },
      req
    );

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private (Admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user (this will cascade delete user_roles and assets)
    await prisma.user.delete({
      where: { id: userId }
    });

    // Log activity
    await AuthService.logActivity(
      req.user.userId,
      req.user.email,
      'delete',
      'user',
      userId,
      { deletedUserEmail: user.email },
      req
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/users/:id/assets
// @desc    Get user's assets (admin only)
// @access  Private (Admin)
router.get('/:id/assets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;

    const assets = await prisma.asset.findMany({
      where: { ownerId: userId },
      orderBy: {
        [sortBy === 'created_at' ? 'createdAt' : sortBy]: sortOrder
      },
      skip,
      take: parseInt(limit)
    });

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

// @route   GET /api/users/:id/activity
// @desc    Get user's activity logs (admin only)
// @access  Private (Admin)
router.get('/:id/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 50, action, resourceType } = req.query;
    const skip = (page - 1) * limit;

    const where = { userId };

    if (action) {
      where.action = action;
    }

    if (resourceType) {
      where.resourceType = resourceType;
    }

    const activities = await prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
