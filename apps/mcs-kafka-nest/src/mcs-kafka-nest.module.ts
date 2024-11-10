import { Module } from '@nestjs/common';
import { McsKafkaNestController } from './mcs-kafka-nest.controller';
import { McsKafkaNestService } from './mcs-kafka-nest.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RedisModule } from '@nestjs-modules/ioredis';
import { KafkaListenerModule } from './kafka-listener/kafka-listener.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          subscribe: {
            fromBeginning: true,
          },
          client: {
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'consumer-nest-client',
          },
        },
      },
    ]),
    RedisModule.forRoot({
      options: undefined,
      type: 'single',
      url: 'juliaosystem.server:30007',
    }),
    KafkaListenerModule,
  ],
  controllers: [McsKafkaNestController],
  providers: [McsKafkaNestService],
})
export class McsKafkaNestModule {}
