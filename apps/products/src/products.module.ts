import { Module } from '@nestjs/common';
import { ProductsController } from './api/controller/products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
