import { Injectable } from '@nestjs/common';
import {ProductsInter} from '../../services/secundary/productsInter';
import { ProductDTO } from 'juliaositembackenexpress/src/api/dtos/productos/ProductosDTO';
import { PlantillaResponse } from 'juliaositembackenexpress/src/utils/PlantillaResponse';

@Injectable()
export class ProductsService implements ProductsInter {
// aqui implementa la logica para los productos 

  findByIdBussines(idBussines: string): PlantillaResponse<ProductDTO> {
    throw new Error('Method not implemented.');
  }
  add(entidad: PlantillaResponse<ProductDTO>): PlantillaResponse<ProductDTO> {
    throw new Error('Method not implemented.');
  }
  update(idBussines: string, idEntidad: string, entidad: PlantillaResponse<ProductDTO>): PlantillaResponse<ProductDTO> {
    throw new Error('Method not implemented.');
  }
  getHello(): string {
    return 'Hello World!';
  }
}
