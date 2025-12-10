import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  serviceName: 'notification-service',

  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'redis123',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    groupId: 'notification-service-group',
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
  },

  sms: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  push: {
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  queues: {
    email: 'email-notifications',
    sms: 'sms-notifications',
    push: 'push-notifications',
  },
};
