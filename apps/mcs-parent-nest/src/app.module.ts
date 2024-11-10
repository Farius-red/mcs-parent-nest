import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { WebhookModule } from './modulos/webhook/webhook.module';

@Module({
  imports: [WebhookModule],
  providers: [AppService],
  controllers: [],
})
export class AppModule {}
