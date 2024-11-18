import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as dotenv from "dotenv";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle("API Documentation taks")
    .setDescription("se encarga de crear tareas  en git  ")
    .addTag("task")
    .setVersion("1.0")
    .build();
  dotenv.config();

  const port = 3005;
  await app
    .listen(port)
    .catch((error) => console.error("no se puede iniciar app ", error));

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("documentacion", app, document);
}

bootstrap();
