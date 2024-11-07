import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { App } from 'juliaositembackenexpress/src/utils/app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice({
    transport: Transport.REDIS,
    options: {
      host: 'juliaosystem.server',
      port: 30007,
    },
  });

  const config = new DocumentBuilder()
    .setTitle('API Documentation redis')
    .setDescription('se encarga de manejar cache con readis')
    .addTag('redis')
    .setVersion('1.0')
    .build();
  dotenv.config();

  const port = process.env.PORT_REDIS || App.port;
  await app
    .listen(port)
    .then(() => {
      App.getApi();
    })
    .catch((error) => console.error('Failed to start microservice', error));

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('documentacion', app, document);
}

bootstrap();
