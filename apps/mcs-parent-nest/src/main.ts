import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Starting mcs-kafka-nest application...'); // Agrega este log al inicio
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);
}
bootstrap();
