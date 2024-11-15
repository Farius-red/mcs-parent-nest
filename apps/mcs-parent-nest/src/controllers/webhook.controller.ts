import { Body, Controller, Post } from '@nestjs/common';
import { WebhookService } from '../services/webhook/webhook.service';

@Controller('tareas')
export class WebhookController {
  constructor(private readonly webkookScv: WebhookService) {}

  @Post('add')
  async handleTaigaWebhook(@Body() payload: any)  {
    return  await this.webkookScv.sendTaskGit(payload);
  }
}
