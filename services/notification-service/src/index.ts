import express from 'express';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { config } from './config';
import { logger } from './services/logger.service';
import { kafkaConsumer } from './services/kafka.consumer';
import { emailQueue, smsQueue, pushQueue, addEmailJob } from './queues/notification.queue';
import { NotificationType, NotificationChannel } from './types/notification';

const app = express();
app.use(express.json());

// Prometheus metrics
const register = new Registry();
collectDefaultMetrics({ register });

const notificationsSent = new Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications sent',
  labelNames: ['channel', 'type', 'status'],
  registers: [register],
});

const notificationLatency = new Histogram({
  name: 'notification_processing_seconds',
  help: 'Notification processing time',
  labelNames: ['channel'],
  registers: [register],
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: config.serviceName });
});

// Readiness check
app.get('/health/ready', async (req, res) => {
  try {
    const emailQueueHealth = await emailQueue.isReady();
    const smsQueueHealth = await smsQueue.isReady();
    const pushQueueHealth = await pushQueue.isReady();

    res.json({
      status: 'ready',
      queues: {
        email: emailQueueHealth ? 'ready' : 'not ready',
        sms: smsQueueHealth ? 'ready' : 'not ready',
        push: pushQueueHealth ? 'ready' : 'not ready',
      },
    });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: String(error) });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Queue stats endpoint
app.get('/api/v1/notifications/stats', async (req, res) => {
  const [emailCounts, smsCounts, pushCounts] = await Promise.all([
    emailQueue.getJobCounts(),
    smsQueue.getJobCounts(),
    pushQueue.getJobCounts(),
  ]);

  res.json({
    email: emailCounts,
    sms: smsCounts,
    push: pushCounts,
  });
});

// Send notification endpoint (for direct API calls)
app.post('/api/v1/notifications/send', async (req, res) => {
  const { channel, type, recipient, subject, data } = req.body;

  try {
    if (channel === NotificationChannel.EMAIL) {
      await addEmailJob({
        to: recipient,
        subject: subject || '',
        template: type,
        data: data || {},
      });
    }

    res.status(202).json({
      message: 'Notification queued',
      channel,
      type,
    });
  } catch (error) {
    logger.error('Failed to queue notification', { error });
    res.status(500).json({ error: 'Failed to queue notification' });
  }
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down notification service...');

  try {
    await kafkaConsumer.disconnect();
    await emailQueue.close();
    await smsQueue.close();
    await pushQueue.close();
    logger.info('Notification service stopped');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const start = async () => {
  try {
    // Connect to Kafka
    try {
      await kafkaConsumer.connect();
    } catch (error) {
      logger.warn('Failed to connect to Kafka, continuing without event consumption', { error });
    }

    app.listen(config.port, () => {
      logger.info(`Notification service listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start notification service', { error });
    process.exit(1);
  }
};

start();
