import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RedisService } from '../../services/redis/redis.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('redis')
export class RedisController {
  constructor(private readonly redisSvc: RedisService) {}

  @Post('set')
  @ApiOperation({ summary: 'Store a key-value pair in Redis' })
  @ApiBody({
    description: 'Key and value para almacenar  en Redis',
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', example: 'myKey' },
        value: { type: 'any', example: { name: 'example', age: 30 } },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'The key-value pair has been saved.',
  })
  setKeyValue(@Body() body: { key: string; value: any }): Observable<string> {
    return this.redisSvc.setObject(body.key, body.value);
  }

  @ApiOperation({
    summary: 'Obtiene un valor de Redis',
    description:
      'Obtiene el valor almacenado para una clave específica en Redis',
  })
  @ApiParam({
    name: 'key',
    description: 'Clave del valor que deseas obtener',
    example: 'exampleKey',
  })
  @Get('get/:key')
  getKeyValue(@Param('key') key: string): Observable<any> {
    return this.redisSvc.getObject(key);
  }
}
