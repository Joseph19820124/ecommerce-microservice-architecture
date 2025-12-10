package kafka

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

type Producer struct {
	writers map[string]*kafka.Writer
	brokers []string
	logger  *zap.Logger
}

func NewProducer(brokers string, logger *zap.Logger) *Producer {
	return &Producer{
		writers: make(map[string]*kafka.Writer),
		brokers: strings.Split(brokers, ","),
		logger:  logger,
	}
}

func (p *Producer) getWriter(topic string) *kafka.Writer {
	if writer, ok := p.writers[topic]; ok {
		return writer
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(p.brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
		RequiredAcks: kafka.RequireAll,
	}

	p.writers[topic] = writer
	return writer
}

func (p *Producer) Publish(topic string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	writer := p.getWriter(topic)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = writer.WriteMessages(ctx, kafka.Message{
		Value: data,
	})

	if err != nil {
		p.logger.Error("Failed to publish message",
			zap.String("topic", topic),
			zap.Error(err),
		)
		return err
	}

	p.logger.Debug("Message published",
		zap.String("topic", topic),
	)

	return nil
}

func (p *Producer) PublishWithKey(topic string, key string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	writer := p.getWriter(topic)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(key),
		Value: data,
	})

	if err != nil {
		p.logger.Error("Failed to publish message",
			zap.String("topic", topic),
			zap.String("key", key),
			zap.Error(err),
		)
		return err
	}

	return nil
}

func (p *Producer) Close() error {
	for topic, writer := range p.writers {
		if err := writer.Close(); err != nil {
			p.logger.Error("Failed to close writer",
				zap.String("topic", topic),
				zap.Error(err),
			)
		}
	}
	return nil
}
