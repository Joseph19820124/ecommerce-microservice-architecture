import { config } from '../config';
import { PushNotification, NotificationResult, NotificationChannel } from '../types/notification';
import { logger } from './logger.service';

interface FirebaseMessaging {
  send: (message: {
    token: string;
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }) => Promise<string>;
}

class PushService {
  private messaging: FirebaseMessaging | null = null;

  constructor() {
    if (config.push.firebaseProjectId) {
      try {
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
          admin.initializeApp({
            projectId: config.push.firebaseProjectId,
          });
        }
        this.messaging = admin.messaging();
        logger.info('Push notification service initialized with Firebase');
      } catch (error) {
        logger.warn('Firebase initialization failed');
      }
    } else {
      logger.warn('Push service not configured - missing Firebase credentials');
    }
  }

  async sendPush(notification: PushNotification): Promise<NotificationResult> {
    if (!this.messaging) {
      logger.warn('Push service not available, skipping push notification');
      return {
        success: false,
        channel: NotificationChannel.PUSH,
        error: 'Push service not configured',
      };
    }

    try {
      const messageId = await this.messaging.send({
        token: notification.token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
      });

      logger.info(`Push notification sent: ${messageId}`, { token: notification.token.substring(0, 20) + '...' });

      return {
        success: true,
        channel: NotificationChannel.PUSH,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send push notification: ${errorMessage}`);

      return {
        success: false,
        channel: NotificationChannel.PUSH,
        error: errorMessage,
      };
    }
  }
}

export const pushService = new PushService();
