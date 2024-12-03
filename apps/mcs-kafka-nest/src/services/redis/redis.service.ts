import { Injectable } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { Observable, from, catchError, of, switchMap } from "rxjs";
import { RedisResponse } from "../../models/serviceResponse";

@Injectable()
export class RedisService {
  constructor(
    @InjectRedis()
    private readonly redisClient: Redis,
  ) {}

  async onModuleInit() {
    try {
      const result = await this.redisClient.ping();
      console.info("Conexión a Redis exitosa", result);
    } catch (error) {
      console.error("Error al conectar a Redis", error);
    }
  }

  sendToRedis(topic: string, message: any): Observable<RedisResponse> {
    return from(this.redisClient.set(topic, message)).pipe(
      switchMap(() => this.validareResponse(message, null)),
      catchError((error) => this.validareResponse(null, error)),
    );
  }

  validareResponse(value: any, error: any): Observable<RedisResponse> {
    let res: RedisResponse;
    if (error != null) {
      res = {
        success: false, message: "Error al obtener el dato", data: null, error: error,
      };
      return of(res);
    }
    if (value) {
      res = { success: true, message: "Se obtuvo el dato exitosamente", data: value, error: null};
      return of(res);
    } else {
      res = {
        success: false,
        message: "No se encontró el dato",
        data: null,
        error: null,
      };
      return of(res);
    }
  }

  get(key: string): Observable<RedisResponse> {
    return from(this.redisClient.get(key).then(JSON.parse)).pipe(
      switchMap((value) => this.validareResponse(value, null)),
      catchError((error) => this.validareResponse(null, error)),
    );
  }

  getByField(
    topic: string,
    fieldName: string,
    value: any,
  ): Observable<RedisResponse> {
    return from(this.redisClient.keys(`${topic}:*`)).pipe(
      switchMap((keys) =>
        from(
          Promise.all(
            keys.map((key) => this.redisClient.get(key).then(JSON.parse)),),),),
      switchMap((values) => {
        if (value.length > 0) {
         return this.validareResponse( values.filter((item) => item && item[fieldName] === value),null)
        } else {
          return of({ success: false, message: "No se encontraron datos",data: [], error: null});
        }}),
      catchError((error) => {
        return this.validareResponse(null, error);
      }),
    );
  }
}
