import nodemailer, { Transporter } from 'nodemailer';
import Handlebars from 'handlebars';
import { config } from '../config';
import { EmailNotification, NotificationResult, NotificationChannel } from '../types/notification';
import { logger } from './logger.service';
import { templates } from '../templates';

class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  async sendEmail(notification: EmailNotification): Promise<NotificationResult> {
    try {
      const template = templates[notification.template];
      if (!template) {
        throw new Error(`Template not found: ${notification.template}`);
      }

      const compiledTemplate = Handlebars.compile(template.html);
      const html = compiledTemplate(notification.data);

      const compiledSubject = Handlebars.compile(notification.subject || template.subject);
      const subject = compiledSubject(notification.data);

      const info = await this.transporter.sendMail({
        from: config.email.from,
        to: notification.to,
        subject,
        html,
      });

      logger.info(`Email sent: ${info.messageId}`, {
        to: notification.to,
        template: notification.template,
      });

      return {
        success: true,
        channel: NotificationChannel.EMAIL,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send email: ${errorMessage}`, {
        to: notification.to,
        template: notification.template,
      });

      return {
        success: false,
        channel: NotificationChannel.EMAIL,
        error: errorMessage,
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.warn('Email service connection failed', { error });
      return false;
    }
  }
}

export const emailService = new EmailService();
