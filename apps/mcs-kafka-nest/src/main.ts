import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { McsKafkaNestModule } from './mcs-kafka-nest.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(McsKafkaNestModule);

  app.connectMicroservice({
    name: 'KAFKA_SERVICE',
    transport: Transport.KAFKA,
    options: {
      subscribe: {
        fromBeginning: true,
      },
      client: {
        brokers: ['localhost:9092'],
        createPartitioner: Partitioners.LegacyPartitioner,
      },
      consumer: {
        groupId: 'consumer-nest-client',
      },
    },
  }) as MicroserviceOptions;

  app.startAllMicroservices();

  const config = new DocumentBuilder()
    .setTitle('API Documentation kafka')
    .setDescription('se encarga de manejar los mensajes a kafka')
    .addTag('Kafka')
    .setVersion('1.0')
    .build();
  dotenv.config();
  const port = process.env.PORT_KAFKA || 3002;

  const basePath = 'documentacion';
  const logo = `
    __  __   __  ___      __    _______  _______  _______  ___   _______  _______  _______  __   __
   |  ||  | |  ||   |    |__|  |   _   ||       ||       ||   | |       ||       ||       ||  |_|  |
   |  ||  | |  ||   |     ___  |  | |  ||   _   ||  _____||   | |  _____||_     _||    ___||       |
   |  ||  | |  ||   |    |   | |  |_|  ||  | |  || |_____ |   | | |_____   |   |  |   |___ |       |
  _|  ||  |_|  ||   |___ |   | |       ||  |_|  ||_____  ||   | |_____  |  |   |  |    ___||       |
 |    ||       ||       ||   | |   _   ||       | _____| ||   |  _____| |  |   |  |   |___ | ||_|| |
 |____||_______||_______||___| |__| |__||_______||_______||___| |_______|  |___|  |_______||_|   |_|

`;

  console.log(logo);

  try {
    // Extrae la versión y el nombre del proyecto
    const version = process.env.KAFKA_VERSION || 'No especificada';
    const projectName = basePath;
    const url = `http://localhost:${port}/${basePath}`;

    // Imprime la información adicional
    console.log(process.env.URL_KAFKA);
    console.log(`
 Project Name: ${projectName}
 Version: ${version}
 Build Date: ${new Date().toLocaleString()}
 Project URL: ${url}
  `);
  } catch (error) {
    console.error('Error reading/parsing tsconfig.app.json:', error);
  }

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('documentacion', app, document);
  await app.listen(port);
}
bootstrap();
