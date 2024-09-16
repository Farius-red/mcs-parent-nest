import { Body, Controller, Logger, Post } from '@nestjs/common';
import { McsKafkaNestService } from './mcs-kafka-nest.service';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('kafka')
export class McsKafkaNestController {
  constructor(private readonly kafkaService: McsKafkaNestService) {}

  @Post('send')
  @ApiOperation({ summary: 'Envia un mensaje a kafka' })
  @ApiBody({
    description: 'se le pasa el nombre del topico y el valor ',
    schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'nombre de topico',
        },
        message: {
          type: 'string',
          description: 'mensaje a enviar',
        },
      },
      required: ['topic', 'message'],
    },
  })
  async sendMessage(@Body() body: { topic: string; message: any }) {
    const { topic, message } = body;
    return this.kafkaService.sendMessage(topic, message);
  }

  @MessagePattern('bussines')
  handleMessage(@Payload() message: any) {
    Logger.log(message, McsKafkaNestService.name);
  }
}
