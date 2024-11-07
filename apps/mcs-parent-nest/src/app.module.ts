import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { RedisController } from './controllers/redis/redis.controller';

@Module({
  imports: [],
  providers: [AppService],
  controllers: [RedisController],
})
export class AppModule {}
