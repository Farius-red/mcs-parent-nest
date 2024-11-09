import { Body, Controller, Logger, Post } from '@nestjs/common';
import { McsKafkaNestService } from './mcs-kafka-nest.service';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { catchError, combineLatest, map, of } from 'rxjs';
import { KafkaResponse, RedisResponse } from './serviseResponse';

@Controller('kafka')
export class McsKafkaNestController {
  constructor(private readonly kafkaService: McsKafkaNestService) {}

  @Post('send')
  @ApiOperation({ summary: 'Envia un mensaje a Kafka y luego a Redis' })
  @ApiBody({
    description: 'Se le pasa el nombre del tópico y el valor del mensaje.',
    schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Nombre del tópico en Kafka',
        },
        message: {
          type: 'any',
          description: 'Mensaje a enviar',
        },
      },
      required: ['topic', 'message'],
    },
  })
  sendMessage(@Body() body: { topic: string; message: any }) {
    const kafkaResponse$ = this.sendOnlyKafka(body);
    const redisResponse$ =this.sendOnlyRedis(body);

    return combineLatest([kafkaResponse$, redisResponse$]).pipe(
      map(([kafkaResponse, redisResponse]) => ({
        kafka: kafkaResponse,
        redis: redisResponse,
      })),
    );
  }



  @Post('send-kafka')
  @ApiOperation({ summary: 'Envia un mensaje solo a Kafka' })
  @ApiBody({
    description: 'Se le pasa el nombre del tópico y el valor del mensaje.',
    schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Nombre del tópico en Kafka',
        },
        message: {
          type: 'any',
          description: 'Mensaje a enviar',
        },
      },
      required: ['topic', 'message'],
    },
  })
  onlyKafka(@Body() body: { topic: string; message: any }) {
    return this.sendOnlyKafka(body).pipe(
      map((kafkaResponse) => ({
        kafka: kafkaResponse,
      })),
    );
  }

  @Post('send-redis')
  @ApiOperation({ summary: 'Envia un mensaje solo a Redis' })
  @ApiBody({
    description: 'Se le pasa el nombre del tópico y el valor del mensaje.',
    schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Nombre del tópico en Kafka',
        },
        message: {
          type: 'any',
          description: 'Mensaje a enviar',
        },
      },
      required: ['topic', 'message'],
    },
  })
  onlyRedis(@Body() body: { topic: string; message: any }) {
    return this.sendOnlyRedis(body).pipe(
      map((redisResponse) => ({
        redis: redisResponse,
      })),
    );
  }


 private  sendOnlyKafka( body: { topic: string; message: any }){
    const { topic, message } = body;
   return  this.kafkaService.sendMessage(topic, message).pipe(
      catchError((error) => {
        Logger.error(`Error al enviar a Kafka: ${error.message}`);
        return of({
          success: false,
          message: 'Error al enviar a Kafka',
          error: error.message,
        } as KafkaResponse);
      }),
    );
  }

  private  sendOnlyRedis(body: { topic: string; message: any }){
    const { topic, message } = body;
    return this.kafkaService.sendToRedis(topic, message).pipe(
      catchError((error) => {
        Logger.error(`Error al enviar a Redis: ${error.message}`);
        return of({
          success: false,
          message: 'Error al enviar a Redis',
          error: error.message,
        } as RedisResponse);
      }),
    );
  }

}