import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { catchError, from, map, Observable, of } from 'rxjs';
import { KafkaResponse, RedisResponse } from './serviseResponse';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class McsKafkaNestService implements OnModuleInit {
  private kafkaClient: ClientKafka;

  constructor(@Inject('KAFKA_SERVICE') private readonly client: ClientKafka,
              @InjectRedis()
              private readonly redisClient: Redis,

) {
    this.kafkaClient = client;
  }

  async onModuleInit() {
    await this.kafkaClient.connect();
    try {
      const result = await this.redisClient.ping();
     console.info('Conexión a Redis exitosa' , result);
    } catch (error) {
      console.error('Error al conectar a Redis', error);
    }
  }

  sendMessage(topic: string, message: any): Observable<KafkaResponse> {
    return from(this.kafkaClient.emit(topic, message)).pipe(
      map(() => ({
        success: true,
        message: `Mensaje enviado a Kafka en el tópico: ${topic}`,
        error: null,
      })),
      catchError((error) => of({
        success: false,
        message: '',
        error: error.message,
      })),
    );
  }

  sendToRedis(channel: string, message: any): Observable<RedisResponse> {
    return from(this.redisClient.set(channel, message)).pipe(
      map(() => ({
        success: true,
        message: 'Mensaje enviado a Redis',
        error: null,
        data: message
      })),
      catchError((error) => of({
        success: false,
        message: '',
        error: error.message,
      })),
    );
  }
}
