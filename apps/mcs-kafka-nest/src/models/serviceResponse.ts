// response.model.ts
export interface ServiceResponse {
  success: boolean;
  message: string;
  error: string | null;
  data?: any;
}

export interface KafkaResponse extends ServiceResponse {}

export interface RedisResponse extends ServiceResponse {}
