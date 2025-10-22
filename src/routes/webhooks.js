const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const prisma = require('../config/prisma');
const { authenticateToken, requireUserOrAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const webhookService = require('../services/WebhookService');

const router = express.Router();

// @route   POST /api/webhooks/subscribe
// @desc    Subscribe to webhook events
// @access  Private (User/Admin)
router.post('/subscribe', authenticateToken, requireUserOrAdmin, [
  body('webhookUrl').isURL().withMessage('Valid webhook URL is required'),
  body('events').isArray({ min: 1 }).withMessage('At least one event type is required'),
  body('events.*').isIn(['asset.uploaded', 'asset.deleted', 'asset.shared', 'asset.updated', 'user.created', 'user.deleted'])
    .withMessage('Invalid event type')
], validateRequest, async (req, res) => {
  try {
    // Set Supabase auth token for RLS
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      supabase.auth.setSession({ access_token: token, refresh_token: null });
    }

    const userId = req.user.userId;
    const { webhookUrl, events, secretKey } = req.body;

    // Check if subscription already exists
    const { data: existingSubscription } = await supabase
      .from('webhook_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('webhook_url', webhookUrl)
      .single();

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Webhook subscription already exists for this URL'
      });
    }

    // Create webhook subscription
    const { data: subscription, error } = await supabase
      .from('webhook_subscriptions')
      .insert({
        user_id: userId,
        webhook_url: webhookUrl,
        events,
        secret_key: secretKey || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create webhook subscription: ${error.message}`);
    }

    res.status(201).json({
      success: true,
      message: 'Webhook subscription created successfully',
      data: subscription
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/webhooks/subscriptions
// @desc    Get user's webhook subscriptions
// @access  Private (User/Admin)
router.get('/subscriptions', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    // Set Supabase auth token for RLS
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      supabase.auth.setSession({ access_token: token, refresh_token: null });
    }

    const userId = req.user.userId;

    const { data: subscriptions, error } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch webhook subscriptions: ${error.message}`);
    }

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/webhooks/subscriptions/:id
// @desc    Update webhook subscription
// @access  Private (User/Admin)
router.put('/subscriptions/:id', authenticateToken, requireUserOrAdmin, [
  body('webhookUrl').optional().isURL(),
  body('events').optional().isArray({ min: 1 }),
  body('events.*').optional().isIn(['asset.uploaded', 'asset.deleted', 'asset.shared', 'asset.updated', 'user.created', 'user.deleted']),
  body('isActive').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    // Set Supabase auth token for RLS
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      supabase.auth.setSession({ access_token: token, refresh_token: null });
    }

    const subscriptionId = req.params.id;
    const userId = req.user.userId;
    const { webhookUrl, events, isActive, secretKey } = req.body;

    // Check ownership
    const { data: subscription } = await supabase
      .from('webhook_subscriptions')
      .select('user_id')
      .eq('id', subscriptionId)
      .single();

    if (!subscription || subscription.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Webhook subscription not found'
      });
    }

    // Update subscription
    const updateData = {};
    if (webhookUrl !== undefined) updateData.webhook_url = webhookUrl;
    if (events !== undefined) updateData.events = events;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (secretKey !== undefined) updateData.secret_key = secretKey;

    const { data: updatedSubscription, error } = await supabase
      .from('webhook_subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update webhook subscription: ${error.message}`);
    }

    res.json({
      success: true,
      message: 'Webhook subscription updated successfully',
      data: updatedSubscription
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/webhooks/subscriptions/:id
// @desc    Delete webhook subscription
// @access  Private (User/Admin)
router.delete('/subscriptions/:id', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    // Set Supabase auth token for RLS
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      supabase.auth.setSession({ access_token: token, refresh_token: null });
    }

    const subscriptionId = req.params.id;
    const userId = req.user.userId;

    // Check ownership
    const { data: subscription } = await supabase
      .from('webhook_subscriptions')
      .select('user_id')
      .eq('id', subscriptionId)
      .single();

    if (!subscription || subscription.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Webhook subscription not found'
      });
    }

    // Delete subscription
    const { error } = await supabase
      .from('webhook_subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (error) {
      throw new Error(`Failed to delete webhook subscription: ${error.message}`);
    }

    res.json({
      success: true,
      message: 'Webhook subscription deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/webhooks/events
// @desc    Get webhook events for user
// @access  Private (User/Admin)
router.get('/events', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, status, eventType } = req.query;
    const offset = (page - 1) * limit;

    // Build query
    const query = {
      'payload.userId': userId
    };

    if (status) {
      query.status = status;
    }

    if (eventType) {
      query.eventType = eventType;
    }

    const events = await prisma.webhookEvent.findMany({
      where: {
        payload: {
          path: ['userId'],
          equals: userId
        },
        ...(status && { status }),
        ...(eventType && { eventType })
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: parseInt(limit)
    });

    const totalEvents = await prisma.webhookEvent.count({
      where: {
        payload: {
          path: ['userId'],
          equals: userId
        },
        ...(status && { status }),
        ...(eventType && { eventType })
      }
    });

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalEvents,
          pages: Math.ceil(totalEvents / limit)
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

// @route   GET /api/webhooks/stats
// @desc    Get webhook statistics
// @access  Private (User/Admin)
router.get('/stats', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const userId = req.user.userId;
    const stats = await webhookService.getWebhookStats();

    // Get user-specific stats
    const userEvents = await prisma.webhookEvent.count({
      where: {
        payload: {
          path: ['userId'],
          equals: userId
        }
      }
    });

    const recentUserEvents = await prisma.webhookEvent.count({
      where: {
        payload: {
          path: ['userId'],
          equals: userId
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      success: true,
      data: {
        global: stats,
        user: {
          totalEvents: userEvents,
          recentEvents: recentUserEvents
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

// @route   POST /api/webhooks/test
// @desc    Test webhook delivery
// @access  Private (User/Admin)
router.post('/test', authenticateToken, requireUserOrAdmin, [
  body('webhookUrl').isURL().withMessage('Valid webhook URL is required')
], validateRequest, async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    const userId = req.user.userId;

    // Create test webhook event
    const testPayload = {
      eventType: 'test',
      userId,
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook event'
    };

    const webhookEvent = await webhookService.createWebhookEvent(
      'test',
      testPayload,
      webhookUrl
    );

    res.json({
      success: true,
      message: 'Test webhook sent successfully',
      data: {
        eventId: webhookEvent._id,
        webhookUrl,
        payload: testPayload
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/webhooks/receive
// @desc    Receive webhook (for testing purposes)
// @access  Public
router.post('/receive', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const eventType = req.headers['x-webhook-event'];
    const timestamp = req.headers['x-webhook-timestamp'];

    console.log('Received webhook:', {
      eventType,
      timestamp,
      signature: signature ? 'present' : 'missing',
      payload: req.body
    });

    // Verify signature if provided
    if (signature) {
      const payload = JSON.stringify(req.body);
      const isValid = webhookService.verifySignature(payload, signature);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
    }

    res.json({
      success: true,
      message: 'Webhook received successfully',
      data: {
        eventType,
        timestamp,
        payload: req.body
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
