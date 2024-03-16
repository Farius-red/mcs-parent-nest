import { Controller, Get } from '@nestjs/common';

import { PlantillaResponse } from 'juliaositembackenexpress/src/utils/PlantillaResponse';
import { ProductDTO } from 'juliaositembackenexpress/src/api/dtos/productos/ProductosDTO';
import { ProductsService } from '../../infraestructure/services/primary/products.service';
import { CrudController } from 'apps/mcs-parent-nest/src/core/utils/crudController';

@Controller("productos")
export class ProductsController extends CrudController<PlantillaResponse<ProductDTO>> {

  constructor(private readonly productsService: ProductsService) {
    super(productsService);
    
  }

  @Get()
  getHello(): string {
    return this.productsService.getHello();
  }
}
