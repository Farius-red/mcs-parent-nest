export type GoogleFormValue = string | number | boolean | string[] | null;

export interface InflatableOrderFormDto {
  [question: string]: GoogleFormValue | undefined;
  "Nombres completos "?: string;
  "Por favor especifique el nombre del inflable"?: string;
  "Tipo de motor "?: string;
  "Los colores de su inflable son iguales a los de la imagen de referencia que concretó con su vendedor ?"?: string;
  "Sí, su respuesta es no, porfavor especifique los colores y ubicación que desea modificar a su producto."?: string;
  "Su inflable lleva impresiones, diseños troquelados(no3d) o muñecos en 3d?"?: string;
  "Sí, su inflable lleva impresiones, porfavor especifique cuales personajes, numeros o texto desea junto con la ubicacion, asi como los muñecos 3d o imagenes troqueladas. (sea muy especifico porfavor, si son iguales a los de imagen de referencia escribalo)"?: string;
}
