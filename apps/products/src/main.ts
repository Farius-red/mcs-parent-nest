import { NestFactory } from '@nestjs/core';
import { ProductsModule } from './products.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {dotenv} from 'dotenv';


async function bootstrap() {
  const app = await NestFactory.create(ProductsModule);

  const config = new DocumentBuilder()
  .setTitle('API Documentation Productos')
  .setDescription('se encarga de manejar toda la parte de productos')
  .setVersion('1.0')
  .build();
  dotenv.config();
  const port = process.env.PORT_PRODUCTS || 3001;
   
  const basePath = 'products';
  const logo =`
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
  const version = process.env.PRODUCTS_VERSION || 'No especificada';
  const projectName = basePath;
  const productsUrl = process.env.PRODUCTS_URL+`${basePath}` || `http://localhost:${port}/${basePath}`;


  // Imprime la información adicional
  console.log(`
 Project Name: ${projectName}
 Version: ${version}
 Build Date: ${new Date().toLocaleString()}
 Project URL: ${productsUrl}
  `);
} catch (error) {
  console.error('Error reading/parsing tsconfig.app.json:', error);
}

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('products', app, document);
  await app.listen(port);
}
bootstrap();
