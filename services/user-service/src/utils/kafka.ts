import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from '../config';
import { logger } from './logger';

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export async function initKafkaProducer(): Promise<Producer> {
  if (producer) return producer;

  producer = kafka.producer();
  await producer.connect();
  logger.info('Kafka producer connected');
  return producer;
}

export async function initKafkaConsumer(topics: string[]): Promise<Consumer> {
  if (consumer) return consumer;

  consumer = kafka.consumer({ groupId: config.kafka.groupId });
  await consumer.connect();
  await consumer.subscribe({ topics, fromBeginning: false });
  logger.info(`Kafka consumer subscribed to topics: ${topics.join(', ')}`);
  return consumer;
}

export async function publishEvent(topic: string, event: {
  type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!producer) {
    throw new Error('Kafka producer not initialized');
  }

  const message = {
    key: event.payload.userId as string || event.payload.id as string || null,
    value: JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
      source: 'user-service',
    }),
  };

  await producer.send({
    topic,
    messages: [message],
  });

  logger.debug(`Event published to ${topic}`, { type: event.type });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
  logger.info('Kafka disconnected');
}

export { kafka };
