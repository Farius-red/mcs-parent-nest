/**
 * Interfaz para proporcionar métodos estándar para operaciones CRUD.
 *
 * @remarks
 * Esta interfaz proporciona métodos estándar para realizar operaciones CRUD (Create, Read, Update, Delete).
 *
 * @example
 * ```typescript
 * const crudService = new MyCrudService();
 *
 * // Ejemplo de uso del método findByIdBussines
 * const entity = crudService.findByIdBussines('123');
 * console.log(entity);
 *
 * // Ejemplo de uso del método add
 * const newEntity = { /* ... * / };
 * const addedEntity = crudService.add(newEntity);
 * 
 *
 * // Ejemplo de uso del método update
 * const updatedEntity = crudService.update('aquiIdNegocio','aquiIdEntidad', updatedEntity);
 * 
 *
 * @version 1
 * @beta
 */
interface juliasistemCrud<E> {
    /**
     * Busca una entidad por su identificador de negocio.
     *
     * @param {string} idBussines - Identificador de negocio de la entidad.
     * @returns {E } - La entidad encontrada o si no encuentra retorna entidad vacia .
     */
    findByIdBussines(idBussines: string): E ;
  
    /**
     * Agrega una nueva entidad.
     *
     * @param {E} entidad - La entidad que se va a agregar.
     * @returns {E} - La entidad recién agregada.
     */
    add(entidad: E): E;
  
    /**
     * Actualiza una entidad existente.
     *
     * @param {string} idBussines - Identificador de negocio de la entidad que se va a actualizar.
     * @param {E} idEntidad - Identificador de la entidad a actualizar 
     * @param {E} entidad - La entidad actualizada.
     * @returns {E} - La entidad actualizada.
     */
    update(idBussines: string, idEntidad:string , entidad: E): E;
  }