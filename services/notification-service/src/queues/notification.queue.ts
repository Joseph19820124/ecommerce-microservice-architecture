import Bull from 'bull';
import { config } from '../config';
import { emailService } from '../services/email.service';
import { smsService } from '../services/sms.service';
import { pushService } from '../services/push.service';
import { logger } from '../services/logger.service';
import { EmailNotification, SmsNotification, PushNotification } from '../types/notification';

const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const emailQueue = new Bull<EmailNotification>(config.queues.email, {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const smsQueue = new Bull<SmsNotification>(config.queues.sms, {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const pushQueue = new Bull<PushNotification>(config.queues.push, {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Process email queue
emailQueue.process(async (job) => {
  logger.info(`Processing email job ${job.id}`, { to: job.data.to });
  const result = await emailService.sendEmail(job.data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result;
});

// Process SMS queue
smsQueue.process(async (job) => {
  logger.info(`Processing SMS job ${job.id}`, { to: job.data.to });
  const result = await smsService.sendSms(job.data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result;
});

// Process push notification queue
pushQueue.process(async (job) => {
  logger.info(`Processing push notification job ${job.id}`);
  const result = await pushService.sendPush(job.data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result;
});

// Queue event handlers
const setupQueueEvents = (queue: Bull.Queue, name: string) => {
  queue.on('completed', (job) => {
    logger.info(`${name} job ${job.id} completed`);
  });

  queue.on('failed', (job, err) => {
    logger.error(`${name} job ${job?.id} failed: ${err.message}`);
  });

  queue.on('stalled', (job) => {
    logger.warn(`${name} job ${job.id} stalled`);
  });
};

setupQueueEvents(emailQueue, 'Email');
setupQueueEvents(smsQueue, 'SMS');
setupQueueEvents(pushQueue, 'Push');

export const addEmailJob = (data: EmailNotification) => emailQueue.add(data);
export const addSmsJob = (data: SmsNotification) => smsQueue.add(data);
export const addPushJob = (data: PushNotification) => pushQueue.add(data);
