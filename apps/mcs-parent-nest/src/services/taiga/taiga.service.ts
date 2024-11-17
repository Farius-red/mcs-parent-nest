import { Injectable } from "@nestjs/common";
import axios, { AxiosRequestConfig } from "axios";
import { AppService } from "../../app.service";

/**
 * Servicio que interactúa con la API de Taiga para obtener el token de autenticación
 * y actualizar tareas en Taiga con la URL de clonación de un repositorio.
 */
@Injectable()
export class TaigaService {
  private userName: string = process.env.GIT_USER; // Nombre de usuario de Taiga
  private password: string = process.env.TIAGA_PASSWORD; // Contraseña de Taiga

  constructor(private appSvc: AppService) {}

  /**
   * Obtiene el token de autenticación de Taiga usando el nombre de usuario y la contraseña.
   *
   * @returns {Promise<string>} El token de autenticación de Taiga.
   * @throws {Error} Si no se reciben las credenciales o el token de Taiga no es válido.
   */
  async obtenerTokenTaiga(): Promise<string> {
    try {
      if (!this.userName || !this.password) {
        throw new Error("Las credenciales de GitHub no están configuradas");
      }

      const response = await axios.post("https://api.taiga.io/api/v1/auth", {
        type: "normal",
        username: this.userName,
        password: this.password,
      });

      const token: any = response.data.auth_token;
      if (!token) {
        throw new Error("No se recibió el token de Taiga");
      }
      return token;
    } catch (error) {
      console.error(
        "TaigaService.obtenerTokenTaiga():",
        error.response ? error.response.data : error.message,
      );
      return `Error al obtener token de taiga: ${this.appSvc.getFormattedDateTime()}`;
    }
  }

  /**
   * Actualiza una tarea en Taiga con la URL de clonación de un repositorio.
   *
   * Este método agrega o actualiza un atributo personalizado de tipo URL (repo) en la tarea de Taiga
   * para incluir la URL de clonación del repositorio correspondiente a la rama creada.
   *
   * @param taskId El ID de la tarea en Taiga que se desea actualizar.
   * @param cloneUrl La URL de clonación del repositorio a asociar con la tarea.
   * @param nameBranch
   * @returns {Promise<string>} Una promesa que indica el éxito o el fallo de la operación.
   * @throws {Error} Si no se puede obtener el token o si ocurre algún error al actualizar la tarea.
   */
  async updateTaigaTask(
    taskId: number,
    cloneUrl: string,
    nameBranch: string,
  ): Promise<string> {
    const url = `https://api.taiga.io/api/v1/userstories/${taskId}`;
    let version: any;
    try {
      const token: any = await this.obtenerTokenTaiga();
      if (!token) {
        throw new Error("No se pudo obtener el token de Taiga");
      }
      const config: AxiosRequestConfig = {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      try {
        version = await axios.get(url, config);
      } catch (error) {
        console.error(
          "TaigaService.updateTaiga() error al obtener version  ",
          error,
        );
      }

      const data: any = {
        version: version.data.version,
        comment: `Se inicia tarea clonar repositorio asi  git clone --branch ${nameBranch.replace(/\s+/g, "")}  ${cloneUrl}`,
      };

      await axios.patch(url, data, config);
      return `Tarea de Taiga actualizada Correcta Mente ${this.appSvc.getFormattedDateTime()}`;
    } catch (error) {
      console.error("Error al actualizar la tarea en Taiga:", error);
      return `Error al actualizar la tarea en Taiga ${this.appSvc.getFormattedDateTime()}`;
    }
  }
}
