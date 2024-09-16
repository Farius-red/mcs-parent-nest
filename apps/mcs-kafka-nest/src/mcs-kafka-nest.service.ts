import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class McsKafkaNestService implements OnModuleInit {
  private kafkaClient: ClientKafka;

  constructor(@Inject('KAFKA_SERVICE') private readonly client: ClientKafka) {
    this.kafkaClient = client;
  }

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async sendMessage(topic: string, message: any) {
    return this.kafkaClient.emit(topic, message);
  }
}
