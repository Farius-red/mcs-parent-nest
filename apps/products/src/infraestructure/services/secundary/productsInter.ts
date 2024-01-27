

import { PlantillaResponse } from 'juliaositembackenexpress/src/utils/PlantillaResponse';
import { ProductDTO } from 'juliaositembackenexpress/src/api/dtos/productos/ProductosDTO';


export interface ProductsInter extends juliasistemCrud<PlantillaResponse<ProductDTO>>{
    
}