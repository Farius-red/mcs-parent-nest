
import { Module } from '@nestjs/common';
import { KafkaListenerService } from './kafka-listener.service';

@Module({
  providers: [KafkaListenerService],
  exports: [KafkaListenerService],
})
export class KafkaListenerModule {}
