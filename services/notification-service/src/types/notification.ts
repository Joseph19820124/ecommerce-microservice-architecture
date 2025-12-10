export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  WELCOME = 'WELCOME',
  PROMOTIONAL = 'PROMOTIONAL',
  LOW_STOCK_ALERT = 'LOW_STOCK_ALERT',
}

export interface NotificationRequest {
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface EmailNotification {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface SmsNotification {
  to: string;
  message: string;
}

export interface PushNotification {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
}
