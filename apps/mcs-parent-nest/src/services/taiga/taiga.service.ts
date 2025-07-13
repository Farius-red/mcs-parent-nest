import { Injectable } from "@nestjs/common";
import axios, { AxiosRequestConfig } from "axios";
import { AppService } from "../../app.service";
import { ConfigService } from "@nestjs/config";

/**
 * Servicio que interactúa con la API de Taiga para obtener el token de autenticación
 * y actualizar tareas en Taiga con la URL de clonación de un repositorio.
 */
@Injectable()
export class TaigaService {
  private userName: string;
  private password: string;
  private cachedToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private appSvc: AppService,
    private configService: ConfigService
  ) {
    this.userName = this.configService.get<string>('GIT_USER');
    this.password = this.configService.get<string>('TIAGA_PASSWORD');
  }

  /**
   * Obtiene el token de autenticación de Taiga usando el nombre de usuario y la contraseña.
   * Utiliza cache para evitar obtener tokens innecesariamente.
   *
   * @returns {Promise<string>} El token de autenticación de Taiga.
   * @throws {Error} Si no se reciben las credenciales o el token de Taiga no es válido.
   */
  async obtenerTokenTaiga(): Promise<string> {
    try {
      // Verificar si el token cached sigue siendo válido
      if (this.isTokenValid()) {
        console.log('Usando token cached de Taiga');
        return this.cachedToken;
      }

      return await this.fetchNewToken();
    } catch (error) {
      this.clearTokenCache();
      throw new Error(`Error al obtener token de taiga: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Verifica si el token cached sigue siendo válido.
   */
  private isTokenValid(): boolean {
    return this.cachedToken && this.tokenExpiry && new Date() < this.tokenExpiry;
  }

  /**
   * Obtiene un nuevo token de Taiga y lo cachea.
   */
  private async fetchNewToken(): Promise<string> {
    if (!this.userName || !this.password) {
      throw new Error("Las credenciales de Taiga no están configuradas correctamente");
    }

    console.log(`Obteniendo nuevo token de Taiga para usuario: ${this.userName}`);
    
    const response = await axios.post("https://api.taiga.io/api/v1/auth", {
      type: "normal",
      username: this.userName,
      password: this.password,
    });

    const token: string = response.data.auth_token;
    if (!token) {
      throw new Error("No se recibió el token de Taiga");
    }

    // Cachear el token por 1 hora
    this.cachedToken = token;
    this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    
    console.log('Token de Taiga obtenido exitosamente');
    return token;
  }

  /**
   * Limpia el cache del token.
   */
  private clearTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Actualiza una tarea o user story en Taiga con la URL de clonación de un repositorio.
   *
   * Este método agrega o actualiza un atributo personalizado de tipo URL (repo) en la tarea/user story de Taiga
   * para incluir la URL de clonación del repositorio correspondiente a la rama creada.
   *
   * @param itemId El ID de la tarea o user story en Taiga que se desea actualizar.
   * @param cloneUrl La URL de clonación del repositorio a asociar con la tarea.
   * @param nameBranch El nombre de la rama.
   * @param itemType El tipo de elemento: 'task' o 'userstory' (por defecto 'userstory').
   * @returns {Promise<string>} Una promesa que indica el éxito o el fallo de la operación.
   * @throws {Error} Si no se puede obtener el token o si ocurre algún error al actualizar la tarea.
   */
  async updateTaigaTask(
    itemId: number,
    cloneUrl: string,
    nameBranch: string,
    itemType: 'task' | 'userstory' = 'userstory',
  ): Promise<string> {
    try {
      const token = await this.obtenerTokenTaiga();
      const version = await this.getItemVersion(itemId, itemType, token);
      
      await this.patchItem(itemId, itemType, version, cloneUrl, nameBranch, token);
      
      console.log(`${itemType} ${itemId} actualizada exitosamente en Taiga`);
      return `${itemType === 'task' ? 'Tarea' : 'User Story'} de Taiga actualizada correctamente ${this.appSvc.getFormattedDateTime()}`;
    } catch (error) {
      console.error(`Error al actualizar la ${itemType} en Taiga:`, error);
      throw error; // Re-lanzar el error para que sea manejado por el webhook service
    }
  }

  /**
   * Obtiene la versión actual de una tarea o user story de Taiga.
   */
  private async getItemVersion(itemId: number, itemType: 'task' | 'userstory', token: string): Promise<number> {
    const endpoint = itemType === 'task' ? 'tasks' : 'userstories';
    const url = `https://api.taiga.io/api/v1/${endpoint}/${itemId}`;
    const config: AxiosRequestConfig = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };

    try {
      const response = await axios.get(url, config);
      return response.data.version;
    } catch (error) {
      console.error(`Error al obtener versión de la ${itemType}:`, error);
      throw new Error(`No se pudo obtener la versión de la ${itemType} ${itemId}`);
    }
  }

  /**
   * Actualiza la tarea o user story en Taiga con el comentario y la información de la rama.
   */
  private async patchItem(
    itemId: number, 
    itemType: 'task' | 'userstory',
    version: number, 
    cloneUrl: string, 
    nameBranch: string, 
    token: string
  ): Promise<void> {
    const endpoint = itemType === 'task' ? 'tasks' : 'userstories';
    const url = `https://api.taiga.io/api/v1/${endpoint}/${itemId}`;
    const data = this.buildItemUpdateData(version, cloneUrl, nameBranch);
    const config = this.buildRequestConfig(token);

    await axios.patch(url, data, config);
  }

  /**
   * Construye los datos para actualizar la tarea o user story.
   */
  private buildItemUpdateData(version: number, cloneUrl: string, nameBranch: string): any {
    return {
      version: version,
      comment: cloneUrl.includes('**Desarrollo iniciado') 
        ? cloneUrl // Es el comentario completo con múltiples repos
        : `Se inicia tarea clonar repositorio asi  git clone --branch ${nameBranch.replace(/\s+/g, "")}  ${cloneUrl}`,
    };
  }

  /**
   * Construye la configuración de la petición HTTP.
   */
  private buildRequestConfig(token: string): AxiosRequestConfig {
    return {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };
  }
}
