

import { PlantillaResponse } from 'juliaositembackenexpress/src/utils/PlantillaResponse';
import { ProductDTO } from 'juliaositembackenexpress/src/api/dtos/productos/ProductosDTO';


import {CrudInterface} from '../../../../../../../juliaositemBackenExpress/src/utils/funtions/crudInterface';

export interface ProductsInter extends CrudInterface<PlantillaResponse<ProductDTO>>{
    
}