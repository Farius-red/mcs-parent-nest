import { Module } from "@nestjs/common";
import { KafkaListenerService } from "../services/kafka-listener/kafka-listener.service";
import { RedisService } from "../services/redis/redis.service";

@Module({
  providers: [KafkaListenerService, RedisService],
  exports: [KafkaListenerService, RedisService],
})
export class KafkaListenerModule {}
