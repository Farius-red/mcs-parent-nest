import { Module } from "@nestjs/common";
import { WebhookController } from "../controllers/webhook.controller";
import { WebhookService } from "../services/webhook/webhook.service";
import { TaigaService } from "../services/taiga/taiga.service";
import { ConfigModule } from "@nestjs/config";
import { AppService } from "../app.service";
import { InflatableOrderController } from "../controllers/inflatable-order.controller";
import { InflatableCatalogService } from "../services/inflatable-catalog.service";
import { InflatableOrderService } from "../services/inflatable-order.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [WebhookController, InflatableOrderController],
  providers: [
    WebhookService,
    TaigaService,
    AppService,
    InflatableCatalogService,
    InflatableOrderService,
  ],
})
export class WebhookModule {}
