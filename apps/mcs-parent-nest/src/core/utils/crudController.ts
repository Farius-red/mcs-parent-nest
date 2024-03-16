import { Body, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam } from "@nestjs/swagger";
import { CrudInterface } from "../../../../../../juliaositemBackenExpress/src/utils/funtions/crudInterface";

/**
 * Controlador genérico para operaciones CRUD.
 *
 * Este controlador proporciona endpoints para realizar operaciones CRUD
 * (Crear, Leer, Actualizar, Eliminar) en entidades de tipo genérico 'E'.
 *
 * @template E - Tipo genérico que representa la entidad.
 * @class
 * @author Daniel Juliao - Desarrollador de juliaosistem
 */
export class CrudController<E> {

  constructor(private readonly crudService: CrudInterface<E>) {}

  /**
   * Busca una entidad por su identificador de negocio.
   *
   * @param {string} idBussines - Identificador de negocio de la entidad.
   * @returns {E } - La entidad encontrada o si no encuentra retorna entidad vacía.
   */
  @Patch(':idBussines')
  @ApiOperation({ summary: 'Buscar entidad por ID de negocio' })
  @ApiParam({ name: 'idBussines', description: 'Identificador de negocio de la entidad' })
  findByIdBussines(@Param('idBussines') idBussines: string): E {
    return this.crudService.findByIdBussines(idBussines);
  }

  /**
   * Agrega una nueva entidad.
   *
   * @param {E} entidad - La entidad que se va a agregar.
   * @returns {E} - La entidad recién agregada.
   */
  @Post()
  @ApiOperation({ summary: 'Agregar nueva entidad' })
  @ApiBody({ type: Object, description: 'Datos de la entidad a agregar' })
  add(@Body() entidad: E): E {
    return this.crudService.add(entidad);
  }

  /**
   * Actualiza una entidad existente.
   *
   * @param {string} idBussines - Identificador de negocio de la entidad que se va a actualizar.
   * @param {string} idEntidad - Identificador de la entidad a actualizar.
   * @param {E} entidad - La entidad actualizada.
   * @returns {E} - La entidad actualizada.
   */
  @Patch(':idBussines/:idEntidad')
  @ApiOperation({ summary: 'Actualizar entidad existente' })
  @ApiParam({ name: 'idBussines', description: 'Identificador de negocio de la entidad' })
  @ApiParam({ name: 'idEntidad', description: 'Identificador de la entidad a actualizar' })
  @ApiBody({ type: Object, description: 'Datos actualizados de la entidad' })
  update(
    @Param('idBussines') idBussines: string,
    @Param('idEntidad') idEntidad: string,
    @Body() entidad: E,
  ): E {
    return this.crudService.update(idBussines, idEntidad, entidad);
  }

  /**
   * Elimina una entidad existente.
   *
   * @param {string} idBussines - Identificador de negocio de la entidad que se va a eliminar.
   * @param {string} idEntidad - Identificador de la entidad a eliminar.
   * @param {E} entidad - La entidad a eliminar.
   * @returns {E} - La entidad eliminada.
   */

  @Patch(':idBussines/:idEntidad')
  @ApiOperation({ summary: 'Eliminar entidad existente' })
  @ApiParam({ name: 'idBussines', description: 'Identificador de negocio de la entidad' })
  @ApiParam({ name: 'idEntidad', description: 'Identificador de la entidad a eliminar' })
  @ApiBody({ type: Object, description: 'Datos de la entidad a eliminar' })
  delete(
    @Param('idBussines') idBussines: string,
    @Param('idEntidad') idEntidad: string,
    @Body() entidad: E,
  ): E {
    return this.crudService.update(idBussines, idEntidad, entidad);
  }
}
