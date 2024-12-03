import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { RedisService } from "../services/redis/redis.service";
import any = jasmine.any;

/**
 * Controlador para manejar operaciones relacionadas con Kafka y Redis.
 */
@Controller("redis")
export class RedisKafkaController {
  constructor(private readonly redisSvc: RedisService) {}
  @Get("byFilter")
  @ApiOperation({
    summary: "Obtiene datos de Redis filtrados por un campo específico.",
  })
  @ApiQuery({
    name: "key",
    description: "Prefijo o nombre del canal en Redis.",
    required: true,
    type: String,
  })
  @ApiQuery({
    name: "fieldName",
    description: "Nombre del campo por el cual filtrar.",
    required: true,
    type: String,
  })
  @ApiQuery({
    name: "fieldValue",
    description: "Valor del campo para realizar la búsqueda.",
    required: true,
    type: any,
  })
  getByField(
    @Query("key") key: string,
    @Query("fieldName") fieldName: string,
    @Query("fieldValue") fieldValue: any,
  ) {
    return this.redisSvc.getByField(key, fieldName, fieldValue);
  }

  @Get("get")
  @ApiOperation({
    summary: "Obtiene datos de Redis filtrados por un campo específico.",
  })
  @ApiQuery({
    name: "key",
    description: "Prefijo o nombre del canal en Redis.",
    required: true,
    type: String,
  })
  get(@Query("key") key: string) {
    return this.redisSvc.get(key);
  }

  @Post("send")
  @ApiOperation({ summary: "Envia un mensaje a Kafka y luego a Redis" })
  @ApiBody({
    description: "Se le pasa el nombre del tópico y el valor del mensaje.",
    schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Nombre del del key de redis",
        },
        message: {
          type: "any",
          description: "Mensaje a enviar",
        },
      },
      required: ["topic", "message"],
    },
  })
  sendMessage(@Body() body: { topic: string; message: any }) {
    const { topic, message } = body;
    return this.redisSvc.sendToRedis(topic, message);
  }
}
