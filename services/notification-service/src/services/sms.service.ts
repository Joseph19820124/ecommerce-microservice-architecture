import { config } from '../config';
import { SmsNotification, NotificationResult, NotificationChannel } from '../types/notification';
import { logger } from './logger.service';

interface TwilioClient {
  messages: {
    create: (params: { body: string; to: string; from: string }) => Promise<{ sid: string }>;
  };
}

class SmsService {
  private client: TwilioClient | null = null;

  constructor() {
    if (config.sms.twilioAccountSid && config.sms.twilioAuthToken) {
      try {
        // Dynamic import to avoid errors when Twilio is not configured
        const twilio = require('twilio');
        this.client = twilio(config.sms.twilioAccountSid, config.sms.twilioAuthToken);
        logger.info('SMS service initialized with Twilio');
      } catch (error) {
        logger.warn('Twilio client initialization failed');
      }
    } else {
      logger.warn('SMS service not configured - missing Twilio credentials');
    }
  }

  async sendSms(notification: SmsNotification): Promise<NotificationResult> {
    if (!this.client) {
      logger.warn('SMS service not available, skipping SMS notification');
      return {
        success: false,
        channel: NotificationChannel.SMS,
        error: 'SMS service not configured',
      };
    }

    try {
      const message = await this.client.messages.create({
        body: notification.message,
        to: notification.to,
        from: config.sms.twilioPhoneNumber,
      });

      logger.info(`SMS sent: ${message.sid}`, { to: notification.to });

      return {
        success: true,
        channel: NotificationChannel.SMS,
        messageId: message.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send SMS: ${errorMessage}`, { to: notification.to });

      return {
        success: false,
        channel: NotificationChannel.SMS,
        error: errorMessage,
      };
    }
  }
}

export const smsService = new SmsService();
