import { Module } from '@nestjs/common';
import { McsKafkaNestController } from './mcs-kafka-nest.controller';
import { McsKafkaNestService } from './mcs-kafka-nest.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: ['localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [McsKafkaNestController],
  providers: [McsKafkaNestService],
})
export class McsKafkaNestModule {}
