import { Module } from '@nestjs/common';

import { ProductsService } from '../src/infraestructure/services/primary/products.service';
import { ProductsController } from './api/controller/products.controller';

@Module({
  imports: [],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
