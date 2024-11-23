import { Injectable } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { Observable, from, map, catchError, of, switchMap } from "rxjs";
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
      map(() => ({
        success: true,
        message: "Mensaje enviado a Redis",
        error: null,
        data: message,
      })),
      catchError((error) =>
        of({
          data: message,
          success: false,
          message: "",
          error: error.message,
        }),
      ),
    );
  }

  getByField(
    topic: string,
    fieldName: string,
    value: any,
  ): Observable<RedisResponse> {
    let res: RedisResponse;
    return from(this.redisClient.keys(`${topic}:*`)).pipe(
      switchMap((keys) =>
        from(
          Promise.all(
            keys.map((key) => this.redisClient.get(key).then(JSON.parse)),
          ),
        ),
      ),
      map((values) => {
        if (value.length > 0) {
          res = {
            success: true,
            message: "Se obtuvieron datos",
            data: values.filter((item) => item && item[fieldName] === value),
            error: null,
          };
          return res;
        } else {
          return (res = {
            success: false,
            message: "No se encontraron datos",
            data: [],
            error: null,
          });
        }
      }),
      catchError((error) =>
        of({
          success: true,
          message: "Error sin datos",
          data: [],
          error: error,
        } as RedisResponse),
      ),
    );
  }
}
