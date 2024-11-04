// response.model.ts
export interface ServiceResponse<T> {
  success: boolean;
  message: string;
  error: string | null;
  data?: T;
}

export interface KafkaResponse extends ServiceResponse<any> {}

export interface RedisResponse extends ServiceResponse<any> {}
