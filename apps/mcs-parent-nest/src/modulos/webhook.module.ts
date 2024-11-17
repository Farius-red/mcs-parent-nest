import { Module } from "@nestjs/common";
import { WebhookController } from "../controllers/webhook.controller";
import { WebhookService } from "../services/webhook/webhook.service";
import { TaigaService } from "../services/taiga/taiga.service";
import { ConfigModule } from "@nestjs/config";
import { AppService } from "../app.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que la configuración esté disponible globalmente
    }),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, TaigaService, AppService],
})
export class WebhookModule {}
