import { Body, Controller, Post } from '@nestjs/common';
import { McsKafkaNestService } from './mcs-kafka-nest.service';
import { ApiBody, ApiOperation } from '@nestjs/swagger';

@Controller('kafka')
export class McsKafkaNestController {
  getHello(): any {
    throw new Error('Method not implemented.');
  }
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
  async sendMessage(@Body() body: { topic: string; message: string }) {
    const { topic, message } = body;
    return this.kafkaService.sendMessage(topic, message);
  }
}
