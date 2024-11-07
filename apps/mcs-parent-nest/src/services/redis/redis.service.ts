import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { from, Observable } from 'rxjs';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redisClient: Redis) {}

  setValue(key: string, value: string): Observable<string> {
    return from(this.redisClient.set(key, value));
  }

  getValue(key: string): Observable<string | null> {
    return from(this.redisClient.get(key));
  }

  setObject(key: string, value: object): Observable<string> {
    const jsonValue = JSON.stringify(value);
    return from(this.redisClient.set(key, jsonValue));
  }

  getObject<T>(key: string): Observable<T | null> {
    return from(
      this.redisClient
        .get(key)
        .then((data) => (data ? (JSON.parse(data) as T) : null)),
    );
  }
}
