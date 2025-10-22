const axios = require('axios');
const crypto = require('node:crypto');
const prisma = require('../config/prisma');

class WebhookService {
  constructor() {
    this.secret = process.env.WEBHOOK_SECRET || 'default-secret';
    this.maxRetries = parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS) || 3;
    this.baseDelay = parseInt(process.env.WEBHOOK_RETRY_DELAY) || 1000;
  }

  // Generate webhook signature
  generateSignature(payload) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
  }

  // Verify webhook signature
  verifySignature(payload, signature) {
    const expectedSignature = this.generateSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Send webhook
  async sendWebhook(webhookEvent) {
    try {
      const payload = JSON.stringify(webhookEvent.payload);
      const signature = this.generateSignature(payload);

      const response = await axios.post(webhookEvent.webhookUrl, webhookEvent.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': webhookEvent.eventType,
          'X-Webhook-Timestamp': new Date().toISOString(),
          'User-Agent': 'DigitalAssetManagement-Webhook/1.0'
        },
        timeout: 30000 // 30 seconds timeout
      });

      // Update webhook event status
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'delivered',
          attempts: webhookEvent.attempts + 1,
          lastAttempt: new Date(),
          deliveredAt: new Date(),
          response: {
            statusCode: response.status,
            body: response.data,
            headers: response.headers
          }
        }
      });

      return true;
    } catch (error) {
      console.error(`Webhook delivery failed for event ${webhookEvent.id}:`, error.message);

      // Update webhook event with error
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          attempts: webhookEvent.attempts + 1,
          lastAttempt: new Date(),
          error: {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR'
          }
        }
      });

      return false;
    }
  }

  // Process webhook with retry logic
  async processWebhook(webhookEvent) {
    const success = await this.sendWebhook(webhookEvent);

    if (!success && webhookEvent.attempts < this.maxRetries) {
      // Calculate next retry time with exponential backoff
      const delay = this.baseDelay * Math.pow(2, webhookEvent.attempts);
      const nextRetry = new Date(Date.now() + delay);

      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'pending',
          nextRetry
        }
      });

      // Schedule retry
      setTimeout(() => {
        this.processWebhook(webhookEvent);
      }, delay);
    }

    return success;
  }

  // Process pending webhooks
  async processPendingWebhooks() {
    try {
      const pendingWebhooks = await prisma.webhookEvent.findMany({
        where: {
          status: 'pending',
          OR: [
            { nextRetry: { lte: new Date() } },
            { nextRetry: null }
          ]
        },
        take: 10
      });

      for (const webhook of pendingWebhooks) {
        await this.processWebhook(webhook);
      }
    } catch (error) {
      console.error('Error processing pending webhooks:', error);
    }
  }

  // Create webhook event
  async createWebhookEvent(eventType, payload, webhookUrl) {
    try {
      const webhookEvent = await prisma.webhookEvent.create({
        data: {
          eventType,
          payload,
          webhookUrl,
          status: 'pending',
          nextRetry: new Date()
        }
      });

      // Process immediately
      await this.processWebhook(webhookEvent);

      return webhookEvent;
    } catch (error) {
      console.error('Error creating webhook event:', error);
      throw error;
    }
  }

  // Get webhook statistics
  async getWebhookStats() {
    try {
      const totalEvents = await prisma.webhookEvent.count();
      const recentEvents = await prisma.webhookEvent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      const statusBreakdown = await prisma.webhookEvent.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      });

      return {
        totalEvents,
        recentEvents,
        statusBreakdown: statusBreakdown.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error getting webhook stats:', error);
      return null;
    }
  }

  // Clean up old webhook events
  async cleanupOldWebhooks(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.webhookEvent.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          status: {
            in: ['delivered', 'failed']
          }
        }
      });

      console.log(`Cleaned up ${result.count} old webhook events`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up old webhooks:', error);
      return 0;
    }
  }
}

// Start webhook processor
const webhookService = new WebhookService();

// Process pending webhooks every 30 seconds
setInterval(() => {
  webhookService.processPendingWebhooks();
}, 30000);

// Clean up old webhooks daily
setInterval(() => {
  webhookService.cleanupOldWebhooks();
}, 24 * 60 * 60 * 1000);

module.exports = webhookService;
