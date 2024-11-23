import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery } from "@nestjs/swagger";
import { RedisService } from "../services/redis/redis.service";
import any = jasmine.any;

/**
 * Controlador para manejar operaciones relacionadas con Kafka y Redis.
 */
@Controller("redis")
export class RedisKafkaController {
  constructor(private readonly redisSvc: RedisService) {}

  /**
   * Obtiene datos de Redis filtrados por un campo específico.
   *
   * @summary Consulta datos almacenados en Redis según el valor de un campo.
   * @operationId getByField
   * @param {string} key - Nombre del canal o prefijo para las claves en Redis.
   * @param {string} fieldName - Nombre del campo a filtrar.
   * @param {any} fieldValue - Valor del campo por el cual se filtra.
   *
   * @returns Observable con los datos filtrados.
   */
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
}
