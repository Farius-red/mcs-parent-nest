import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { WebhookModule } from './modulos/webhook.module';
import { AppController } from './app.controller';

@Module({
  imports: [WebhookModule],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}
