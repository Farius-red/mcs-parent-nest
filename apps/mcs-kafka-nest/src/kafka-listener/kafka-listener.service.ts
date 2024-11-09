
import { Injectable, Logger } from '@nestjs/common';
import { MessagePattern, Payload,  } from '@nestjs/microservices';

@Injectable()
export class KafkaListenerService {
  private readonly logger = new Logger(KafkaListenerService.name);

  @MessagePattern('bussines')
  async handleMessageBussines(@Payload() message: any) {
    this.logger.log(`Received message from 'bussines': ${JSON.stringify(message)}`);
  }


  @MessagePattern('otro-topico')
  async handleOtherTopic(@Payload() message: any) {
    this.logger.log(`Received message from 'otro-topico': ${JSON.stringify(message)}`);
  }
}
