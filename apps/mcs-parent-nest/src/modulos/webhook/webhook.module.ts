import { Module } from '@nestjs/common';
import { WebhookController } from './controller/webhook.controller';
import { WebhookService } from './services/webhook.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}