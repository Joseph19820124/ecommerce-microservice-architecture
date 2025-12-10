import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { logger } from './logger.service';
import { addEmailJob } from '../queues/notification.queue';
import { NotificationType } from '../types/notification';

class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.serviceName,
      brokers: config.kafka.brokers,
    });
    this.consumer = this.kafka.consumer({ groupId: config.kafka.groupId });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      logger.info('Kafka consumer connected');

      await this.consumer.subscribe({
        topics: ['order-events', 'payment-events', 'user-events', 'notification-events'],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });
    } catch (error) {
      logger.error('Failed to connect Kafka consumer', { error });
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, message } = payload;

    try {
      const value = message.value?.toString();
      if (!value) return;

      const event = JSON.parse(value);
      logger.info(`Received event from ${topic}`, { eventType: event.eventType });

      switch (topic) {
        case 'notification-events':
          await this.handleNotificationEvent(event);
          break;
        case 'order-events':
          await this.handleOrderEvent(event);
          break;
        case 'payment-events':
          await this.handlePaymentEvent(event);
          break;
        case 'user-events':
          await this.handleUserEvent(event);
          break;
        default:
          logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Error processing message from ${topic}`, { error });
    }
  }

  private async handleNotificationEvent(event: any): Promise<void> {
    const { notificationType, userId, channel, subject, message, metadata } = event;

    if (channel === 'EMAIL' && metadata?.email) {
      await addEmailJob({
        to: metadata.email,
        subject: subject || 'Notification',
        template: notificationType,
        data: { ...metadata, message },
      });
    }
  }

  private async handleOrderEvent(event: any): Promise<void> {
    const { eventType, orderNumber, userId, totalAmount, currency } = event;

    const templateMap: Record<string, NotificationType> = {
      OrderCreated: NotificationType.ORDER_CREATED,
      OrderConfirmed: NotificationType.ORDER_CONFIRMED,
      OrderShipped: NotificationType.ORDER_SHIPPED,
      OrderDelivered: NotificationType.ORDER_DELIVERED,
      OrderCancelled: NotificationType.ORDER_CANCELLED,
    };

    const template = templateMap[eventType];
    if (!template) return;

    // In production, fetch user email from user service
    const customerEmail = event.customerEmail || `user-${userId}@example.com`;
    const customerName = event.customerName || 'Customer';

    await addEmailJob({
      to: customerEmail,
      subject: '',
      template,
      data: {
        customerName,
        orderNumber,
        totalAmount,
        currency: currency || 'USD',
        trackingNumber: event.trackingNumber,
        trackingUrl: `https://ecommerce.com/orders/${orderNumber}`,
        reviewUrl: `https://ecommerce.com/orders/${orderNumber}/review`,
        cancelReason: event.cancelReason,
      },
    });

    logger.info(`Queued ${eventType} notification for order ${orderNumber}`);
  }

  private async handlePaymentEvent(event: any): Promise<void> {
    const { eventType, orderId, amount, currency, transactionId } = event;

    if (eventType === 'PaymentCompleted') {
      const customerEmail = event.customerEmail || 'customer@example.com';
      const customerName = event.customerName || 'Customer';

      await addEmailJob({
        to: customerEmail,
        subject: '',
        template: NotificationType.PAYMENT_SUCCESS,
        data: {
          customerName,
          orderNumber: event.orderNumber || orderId,
          amount,
          currency: currency || 'USD',
          transactionId,
        },
      });

      logger.info(`Queued payment success notification for order ${orderId}`);
    }
  }

  private async handleUserEvent(event: any): Promise<void> {
    const { eventType, email, firstName } = event;

    if (eventType === 'UserCreated') {
      await addEmailJob({
        to: email,
        subject: '',
        template: NotificationType.WELCOME,
        data: {
          customerName: firstName || 'Customer',
          shopUrl: 'https://ecommerce.com/shop',
        },
      });

      logger.info(`Queued welcome email for ${email}`);
    } else if (eventType === 'PasswordResetRequested') {
      await addEmailJob({
        to: email,
        subject: '',
        template: NotificationType.PASSWORD_RESET,
        data: {
          customerName: firstName || 'Customer',
          resetUrl: event.resetUrl,
        },
      });

      logger.info(`Queued password reset email for ${email}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
}

export const kafkaConsumer = new KafkaConsumer();
