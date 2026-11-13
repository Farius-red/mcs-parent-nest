import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import { InflatableOrderFormDto } from "../dto/inflatable-order.dto";
import {
  InflatableOrderResult,
  InflatableOrderService,
} from "../services/inflatable-order.service";

@Controller("taiga")
export class InflatableOrderController {
  constructor(
    private readonly orderService: InflatableOrderService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registra en Taiga un pedido de inflable recibido desde Google Forms.
   *
   * @param payload Respuestas del formulario indexadas por título de pregunta.
   * @param webhookSecret Secreto compartido configurado en Google Apps Script.
   * @returns Código de lote y referencia de la historia creada.
   */
  @Post("inflatable-order")
  async createInflatableOrder(
    @Body() payload: InflatableOrderFormDto,
    @Headers("x-webhook-secret") webhookSecret?: string,
  ): Promise<InflatableOrderResult> {
    this.validateWebhookSecret(webhookSecret);
    return this.orderService.createOrder(payload);
  }

  private validateWebhookSecret(providedSecret?: string): void {
    const expectedSecret = this.configService.get<string>(
      "INFLATABLE_ORDER_WEBHOOK_SECRET",
    );
    if (!expectedSecret || !providedSecret) {
      throw new UnauthorizedException("Webhook no autorizado");
    }
    const provided = Buffer.from(providedSecret);
    const expected = Buffer.from(expectedSecret);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException("Webhook no autorizado");
    }
  }
}
