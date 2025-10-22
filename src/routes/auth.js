const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/AuthService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const prisma = require('../config/prisma');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerValidation, validateRequest, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    const result = await AuthService.register({
      email,
      password,
      firstName,
      lastName
    });

    // Log registration activity
    await AuthService.logActivity(
      result.user.id,
      result.user.email,
      'register',
      'user',
      result.user.id,
      { method: 'email' },
      req
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await AuthService.login(email, password);

    // Log login activity
    await AuthService.logActivity(
      result.user.id,
      result.user.email,
      'login',
      'user',
      result.user.id,
      { method: 'email' },
      req
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/google
// @desc    Google OAuth login/register
// @access  Public
router.post('/google', [
  body('email').isEmail().normalizeEmail(),
  body('name').notEmpty().withMessage('Name is required'),
  body('googleId').notEmpty().withMessage('Google ID is required'),
  body('picture').optional().isURL()
], validateRequest, async (req, res) => {
  try {
    const { email, name, picture, googleId } = req.body;

    const result = await AuthService.googleAuth({
      email,
      name,
      picture,
      googleId
    });

    // Log login/register activity
    await AuthService.logActivity(
      result.user.id,
      result.user.email,
      result.user.isVerified ? 'login' : 'register',
      'user',
      result.user.id,
      { method: 'google', googleId },
      req
    );

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isVerified: true,
        lastLogin: true,
        createdAt: true,
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

    const userRoles = user.userRoles?.map(ur => ur.role.name) || ['user'];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        roles: userRoles
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log logout activity
    await AuthService.logActivity(
      req.user.userId,
      req.user.email,
      'logout',
      'user',
      req.user.userId,
      {},
      req
    );

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const { supabase } = require('../config/supabase');
    const userId = req.user.userId;

    // Verify user still exists and is active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('id', userId)
      .single();

    if (error || !user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Get user roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select(`
        roles (
          name
        )
      `)
      .eq('user_id', userId);

    const userRoles = roles?.map(ur => ur.roles.name) || ['user'];

    // Generate new token
    const token = AuthService.generateToken({
      userId: user.id,
      email: user.email,
      roles: userRoles
    });

    res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
});

module.exports = router;
