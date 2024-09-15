import { Controller, Get } from '@nestjs/common';

import { ProductsService } from '../../infraestructure/services/primary/products.service';

@Controller('productos')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {
    //super(productsService);
  }

  @Get()
  getHello(): string {
    return this.productsService.getHello();
  }
}
