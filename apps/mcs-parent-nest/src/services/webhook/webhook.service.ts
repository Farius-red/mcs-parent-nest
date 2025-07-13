import { AppService } from "./../../app.service";
import { Injectable } from "@nestjs/common";
import axios, { AxiosRequestConfig } from "axios";
import { DataResponseDTO } from "../../responses/dataResponseDTO";
import { TaigaService } from "../taiga/taiga.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WebhookService {
  constructor(
    private readonly taigaSvc: TaigaService,
    private configService: ConfigService,
    private appSvc: AppService,
  ) {}

  headers = {
    Authorization: `Bearer ${this.configService.get<string>("GITHUB_TOKEN")}`,
    Accept: "application/vnd.github.v3+json",
  };

  /**
   * Este método principal maneja la lógica del webhook para crear o actualizar un issue
   * en GitHub basado en el payload recibido de taiga .
   * @returns Una promesa con el resultado de la operación (creación o actualización de issue).
   */
  async sendTaskGit(payload: any): Promise<string> {
    try {
      const repositories = await this.checkActionGit(payload);
      const ramaName = `${repositories[0].data.ref}-${repositories[0].data.title}`;
      
      const results = await this.processRepositories(repositories, ramaName);
      
      // Si hay ramas creadas (UPDATE_ISSUE), actualizar Taiga con toda la información
      if (repositories.length > 0 && repositories[0].data.res === "UPDATE_ISSUE") {
        const itemType = payload.type === 'task' ? 'task' : 'userstory';
        await this.updateTaigaWithAllRepos(repositories, ramaName, results, itemType);
      }
      
      return this.buildSuccessResponse(repositories, results);
    } catch (error) {
      return this.handleSendTaskGitError(error);
    }
  }

  /**
   * Construye la respuesta de éxito del procesamiento.
   */
  private buildSuccessResponse(repositories: DataResponseDTO[], results: string[]): string {
    if (results.length === 0) {
      return `No entro a ningun cambio de tarea valido ${this.appSvc.getFormattedDateTime()}`;
    }
    
    return `Procesamiento completado para ${repositories.length} repositorio(s):\n${results.join('\n')}`;
  }

  /**
   * Maneja los errores del método sendTaskGit.
   */
  private handleSendTaskGitError(error: any): string {
    console.error("Error en sendTaskGit:", error);
    
    // Manejo específico de webhooks ignorados
    if (error.message.includes("Webhook ignorado")) {
      return `⏩ ${error.message} - ${this.appSvc.getFormattedDateTime()}`;
    }
    
    // Manejo de errores de datos inválidos
    if (error.message.includes("Datos de payload no válidos")) {
      return `❌ Datos de payload no válidos para procesar - ${this.appSvc.getFormattedDateTime()}`;
    }
    
    return `❌ Error al procesar Task en Git: ${error.message} - ${this.appSvc.getFormattedDateTime()}`;
  }

  /**
   * Procesa todos los repositorios para ejecutar las acciones correspondientes.
   * @param repositories - Array de repositorios a procesar.
   * @param ramaName - Nombre de la rama a crear.
   * @returns Array con los resultados de cada repositorio.
   */
  private async processRepositories(repositories: DataResponseDTO[], ramaName: string): Promise<string[]> {
    const results: string[] = [];
    
    for (const repo of repositories) {
      const result = await this.processRepository(repo, ramaName);
      if (result) {
        results.push(`[${this.getRepoName(repo.config.url)}] ${result}`);
      }
    }
    
    return results;
  }

  /**
   * Procesa un repositorio individual según la acción requerida.
   * @param repo - El repositorio a procesar.
   * @param ramaName - Nombre de la rama a crear.
   * @returns El resultado de la operación o null si no se realizó ninguna acción.
   */
  private async processRepository(repo: DataResponseDTO, ramaName: string): Promise<string | null> {
    if (repo.data.res === "CREATE_ISSUE") {
      return await this.createGithubIssue(
        repo.data.title,
        repo.data.description,
        repo.config.url,
      );
    }
    
    if (repo.data.res === "UPDATE_ISSUE") {
      return await this.manageCreateBranch(repo, ramaName);
    }
    
    if (repo.data.res === "DELETE_ISSUE") {
      return await this.closeGithubIssue(repo, repo.data.title);
    }
    
    return null;
  }

  /**
   * Maneja la creación de una rama en GitHub y la asociación con un issue.
   * Si no existe un issue, crea uno nuevo automáticamente.
   *
   * @param res - Objeto con la configuración de GitHub y datos relacionados con la tarea.
   * @param ramaName - El nombre de la rama a crear.
   *
   * @returns El resultado de la operación de creación de rama y asociación con issue.
   */
  
  // eslint-disable-next-line max-lines-per-function
  async manageCreateBranch(
    res: DataResponseDTO,
    ramaName: string,
  ): Promise<string> {
    try {
      const isBranchCreated = await this.createGithubBranch(
        res.config.url,
        ramaName,
      );

      if (isBranchCreated.match("Error")) {
        return isBranchCreated;
      }

      let issueNumber = await this.findGithubIssue(
        res.data.title,
        res.config,
      );

      // Si no existe un issue, crear uno nuevo
      if (!issueNumber) {
        console.log(`No se encontró issue existente para "${res.data.title}" en ${this.getRepoName(res.config.url)}, creando uno nuevo...`);
        
        const createIssueResult = await this.createGithubIssue(
          res.data.title,
          res.data.description,
          res.config.url,
        );

        if (createIssueResult.includes("Error")) {
          return `Rama ${ramaName} creada, pero no se pudo crear ni asociar issue: ${createIssueResult}`;
        }

        // Buscar el issue recién creado
        issueNumber = await this.findGithubIssue(
          res.data.title,
          res.config,
        );
        
        if (issueNumber) {
          console.log(`Issue #${issueNumber} creado automáticamente en ${this.getRepoName(res.config.url)}`);
        }
      }

      if (issueNumber) {
        await this.associateBranchWithIssue(
          res.config.url,
          issueNumber,
          ramaName,
        );

        return `Rama ${ramaName} creada y asociada con issue #${issueNumber}`;
      } else {
        return `Se creó la rama ${ramaName} pero no se pudo crear ni asociar un issue en GitHub`;
      }
    } catch (error) {
      console.error("Error en manageCreateBranch:", error);
      return `Error al crear la rama ${ramaName}`;
    }
  }

  /**
   * Verifica la acción del webhook y retorna la respuesta correspondiente según el tipo de acción.
   * @param payload - El payload del webhook que contiene la información de la tarea.
   * @returns Un array de objetos `DataResponseDTO` que contiene la configuración y los datos de cada repositorio.
   */
  // eslint-disable-next-line max-lines-per-function
  async checkActionGit(payload: any): Promise<DataResponseDTO[]> {
    // Logging para debugging
    console.log('🔍 Payload recibido:');
    console.log(`- Acción: ${payload.action}`);
    console.log(`- Tipo: ${payload.type}`);
    console.log(`- Estado actual: ${payload.data?.status?.name}`);
    console.log(`- Cambios en diff:`, Object.keys(payload.change?.diff || {}));
    console.log(`- ¿Tiene comentario?: ${!!payload.change?.comment}`);
    
    // Verificar si este webhook debe ser procesado
    if (payload.action === "change") {
      // Solo validar que tenemos la información mínima necesaria
      if (!payload.data?.status?.name) {
        console.log('⏩ Webhook ignorado: No se puede determinar el estado actual');
        throw new Error("Webhook ignorado: Estado actual no disponible");
      }
    }
    
    if (
      payload.data.description.length > 0 &&
      payload.data.subject.length > 0
    ) {
      const description = payload.data.description;
      
      const uniqueRepoUrls = this.extractRepositoryUrls(description);
      
      if (uniqueRepoUrls.length > 0 && (payload.type === "userstory" || payload.type === "task")) {
        const responses: DataResponseDTO[] = [];
        
        for (const repoUrl of uniqueRepoUrls) {
          console.log(`🔍 Procesando repositorio: ${this.getRepoName(repoUrl)}`);
          const response: DataResponseDTO = {
            config: { url: repoUrl },
            data: {
              description: description,
              title: payload.data.subject,
              id: payload.data.id,
              ref: payload.data.ref,
            },
          };

          if (payload.action === "create") {
            response.data.res = "CREATE_ISSUE";
          } else if (payload.action === "change") {
            // Verificar si hay cambios en el estado
            if (payload.change?.diff?.status?.to) {
              if (payload.change.diff.status.to === "In progress") {
                response.data.res = "UPDATE_ISSUE";
                console.log(`✅ Acción asignada: UPDATE_ISSUE para ${this.getRepoName(repoUrl)}`);
              } else if (payload.change.diff.status.to === "Finalizada") {
                response.data.res = "DELETE_ISSUE";
                console.log(`✅ Acción asignada: DELETE_ISSUE para ${this.getRepoName(repoUrl)}`);
              }
            } else {
              // Si no hay cambios de estado, usar el estado actual
              const currentStatus = payload.data?.status?.name;
              console.log(`No hay diff de estado, usando estado actual: ${currentStatus}`);
              
              if (currentStatus === "In progress") {
                response.data.res = "UPDATE_ISSUE";
                console.log(`✅ Acción asignada: UPDATE_ISSUE para ${this.getRepoName(repoUrl)}`);
              } else if (currentStatus === "Finalizada") {
                response.data.res = "DELETE_ISSUE";
                console.log(`✅ Acción asignada: DELETE_ISSUE para ${this.getRepoName(repoUrl)}`);
              } else {
                console.log(`Estado actual: ${currentStatus} - no requiere acción en GitHub`);
                continue; // Saltar este repositorio
              }
            }
          }
          
          responses.push(response);
        }

        return responses;
      }
    }

    throw new Error(
      "Datos de payload no válidos para crear o actualizar un issue.",
    );
  }

  /**
   * Busca un issue en GitHub utilizando el nombre de la rama como título.
   * @param branchName - El nombre de la rama que será usada como criterio de búsqueda.
   * @param config - La configuración de la solicitud para acceder al repositorio de GitHub.
   * @returns El número del issue encontrado o null si no se encuentra.
   */
  async findGithubIssue(
    branchName: string,
    config: AxiosRequestConfig,
  ): Promise<number | null> {
    try {
      const response = await this.retryWithBackoff(async () => {
        const updatedConfig = {
          url: `${config.url}/issues?state=open`,
          method: "GET",
          headers: this.headers,
          timeout: 30000,
        };
        return await axios.get(updatedConfig.url, updatedConfig);
      });

      const issues = response.data;
      const issue = issues.find((issue: any) => issue.title === branchName);

      return issue ? issue.number : null;
    } catch (error) {
      console.error(`Error al buscar el issue en ${this.getRepoName(config.url)}:`, error);
      throw new Error("Error al buscar el issue en GitHub");
    }
  }

  /**
   * Cierra un issue en GitHub utilizando su número del issue.
   * @param config - Objeto con la configuración del repositorio.
   * @param branchName - El nombre de la rama asociada al issue.
   * @returns Un mensaje con el resultado de la operación.
   */
  async closeGithubIssue(
    config: DataResponseDTO,
    branchName: string,
  ): Promise<string> {
    try {
      const issueNumber = await this.findGithubIssue(branchName, config.config);
      
      if (!issueNumber) {
        return `No se encontró un issue asociado con el nombre ${branchName}`;
      }

      await this.executeCloseIssue(config.config.url, issueNumber);
      
      console.log(`Issue #${issueNumber} cerrado en ${this.getRepoName(config.config.url)}`);
      return `Se cerró el issue #${issueNumber} correctamente ${this.appSvc.getFormattedDateTime()} Hora Colombia`;
    } catch (error) {
      console.error(`Error al cerrar issue en ${this.getRepoName(config.config.url)}:`, error);
      return `Error al cerrar issue: ${this.appSvc.getFormattedDateTime()} Hora Colombia`;
    }
  }

  /**
   * Ejecuta el cierre de un issue en GitHub.
   * @param repoUrl - URL del repositorio.
   * @param issueNumber - Número del issue a cerrar.
   */
  private async executeCloseIssue(repoUrl: string, issueNumber: number): Promise<void> {
    await this.retryWithBackoff(async () => {
      const config = {
        url: `${repoUrl}/issues/${issueNumber}`,
        method: "PATCH",
        headers: this.headers,
        data: { state: "closed" },
        timeout: 30000,
      };
      return await axios.patch(config.url, config.data, config);
    });
  }

  /**
   * Crea un nuevo issue en GitHub con el título y descripción proporcionados.
   * @param title - El título del issue a crear.
   * @param body - La descripción del issue.
   * @param repoUrl - La URL del repositorio donde se creará el issue.
   */
  async createGithubIssue(
    title: string,
    body: string,
    repoUrl: string,
  ): Promise<string> {
    try {
      console.log(`🔄 Intentando crear issue en ${this.getRepoName(repoUrl)}`);
      console.log(`- Título: "${title}"`);
      console.log(`- URL del repo: ${repoUrl}`);
      
      // Verificar acceso al repositorio antes de crear el issue
      const hasAccess = await this.verifyRepositoryAccess(repoUrl);
      if (!hasAccess) {
        return `Error: No se puede acceder al repositorio ${this.getRepoName(repoUrl)}. Verifica que el repositorio existe y tienes los permisos necesarios.`;
      }
      
      await this.executeCreateIssue(title, body, repoUrl);
      console.log(`✅ Issue creado con éxito en ${this.getRepoName(repoUrl)}`);
      return "Issue creado con éxito en GitHub";
    } catch (error) {
      return this.handleCreateIssueError(error, repoUrl);
    }
  }

  /**
   * Maneja los errores específicos al crear issues en GitHub.
   */
  private handleCreateIssueError(error: any, repoUrl: string): string {
    console.error(`❌ Error al crear el issue en ${this.getRepoName(repoUrl)}:`, error);
    
    // Logging detallado del error
    if (error.response) {
      console.error(`- Status HTTP: ${error.response.status}`);
      console.error(`- Mensaje de error:`, error.response.data);
      console.error(`- Headers de respuesta:`, error.response.headers);
      
      // Errores específicos
      if (error.response.status === 404) {
        return `Error: Repositorio ${this.getRepoName(repoUrl)} no encontrado o sin acceso`;
      } else if (error.response.status === 403) {
        return `Error: Sin permisos para crear issues en ${this.getRepoName(repoUrl)}`;
      } else if (error.response.status === 401) {
        return `Error: Token de GitHub inválido o expirado`;
      }
    } else if (error.code) {
      console.error(`- Error de red: ${error.code}`);
      return `Error de conectividad al crear issue en ${this.getRepoName(repoUrl)}`;
    }
    
    return `Error al crear el issue en GitHub: ${error.message}`;
  }

  /**
   * Ejecuta la creación de un issue en GitHub con reintentos.
   * @param title - El título del issue.
   * @param body - La descripción del issue.
   * @param repoUrl - La URL del repositorio.
   */
  private async executeCreateIssue(title: string, body: string, repoUrl: string): Promise<void> {
    const data = { title, body };
    const config: AxiosRequestConfig = {
      url: `${repoUrl}/issues`,
      method: "POST",
      data,
      headers: this.headers,
      timeout: 30000,
    };

    await this.retryWithBackoff(async () => {
      return await axios.post(config.url, config.data, config);
    });
  }

  /**
   * Crea una nueva rama en el repositorio de GitHub.
   * @param repoUrl - La URL del repositorio donde se creará la rama.
   * @param branchName - El nombre de la nueva rama.
   */
  // eslint-disable-next-line max-lines-per-function
  async createGithubBranch(
    repoUrl: string,
    branchName: string,
  ): Promise<string> {
    const repoApiUrl = `${repoUrl}/git/refs`;

    try {
      // Verificar acceso al repositorio antes de crear la rama
      const hasAccess = await this.verifyRepositoryAccess(repoUrl);
      if (!hasAccess) {
        return `Error: No se puede acceder al repositorio ${this.getRepoName(repoUrl)}. Verifica que el repositorio existe y tienes los permisos necesarios.`;
      }

      // Usar reintentos para obtener el último commit
      const { data: defaultBranchData } = await this.retryWithBackoff(async () => {
        const config: AxiosRequestConfig = {
          method: "GET",
          headers: this.headers,
          url: repoUrl,
          timeout: 30000,
        };
        return await this.getLastCommit(config);
      });

      const sha = defaultBranchData.sha;
      const data = { ref: `refs/heads/${branchName.replace(/\s+/g, "")}`, sha };
      
      // Usar reintentos para crear la rama
      await this.retryWithBackoff(async () => {
        const branchConfig: AxiosRequestConfig = {
          headers: this.headers,
          method: "POST",
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 300,
        };
        return await axios.post(`${repoApiUrl}`, data, branchConfig);
      });

      console.log(`Rama ${branchName} creada exitosamente.`);
      return `Rama ${branchName} creada con éxito.`;
    } catch (error) {
      console.error("Error al crear la rama:", error);
      
      // Verificar si el error tiene respuesta HTTP
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
        
        if (error.response.data?.message === "Reference already exists") {
          return `Error No se pudo crear La rama con nombre ${branchName} porque ya existe en el repo : ${this.appSvc.getFormattedDateTime()} Hora Colombiana`;
        }
        
        return `Error HTTP ${error.response.status}: No se pudo crear la rama. ${this.appSvc.getFormattedDateTime()} Hora Colombiana`;
      }
      
      // Manejar errores de red específicos
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.message.includes('socket hang up')) {
        console.error("Error de conectividad de red:", error.code || error.message);
        return `Error de conectividad: No se pudo conectar con GitHub después de varios intentos. Verifica tu conexión a internet. ${this.appSvc.getFormattedDateTime()} Hora Colombiana`;
      }
      
      // Error genérico
      return `Error: No se pudo crear la rama, abortando el proceso. ${this.appSvc.getFormattedDateTime()} Hora Colombiana`;
    }
  }

  /**
   * Obtiene el último commit de la rama `develop` del repositorio para obtener su SHA.
   * @param config - La configuración de la solicitud para acceder al repositorio de GitHub.
   * @returns Los datos del último commit en la rama `develop`.
   */
  async getLastCommit(config: AxiosRequestConfig) {
    try {
      const enhancedConfig = this.buildEnhancedConfig(config);
      const response = await axios.get(`${config.url}/commits/develop`, enhancedConfig);
      console.log(`Último commit obtenido exitosamente. SHA: ${response.data.sha}`);
      return response;
    } catch (error) {
      console.error("webhookService.getLastCommit() ", error);
      throw this.handleGetLastCommitError(error);
    }
  }

  /**
   * Construye una configuración mejorada para las peticiones HTTP.
   * @param config - La configuración base.
   * @returns Configuración mejorada con timeouts y validaciones.
   */
  private buildEnhancedConfig(config: AxiosRequestConfig): AxiosRequestConfig {
    return {
      ...config,
      timeout: config.timeout || 30000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300,
    };
  }

  /**
   * Maneja los errores del método getLastCommit.
   * @param error - El error a manejar.
   * @returns Error apropiado según el tipo de fallo.
   */
  private handleGetLastCommitError(error: any): Error {
    const timestamp = this.appSvc.getFormattedDateTime();
    
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.message.includes('socket hang up')) {
      return new Error(`Error de conectividad: No se pudo conectar con GitHub para obtener el último commit. ${timestamp} Hora Colombiana`);
    }
    
    if (error.response) {
      return new Error(`Error HTTP ${error.response.status}: No se pudo obtener el último commit. ${timestamp} Hora Colombiana`);
    }
    
    return new Error(`Error No se pudo obtener el último commit ${timestamp} Hora Colombiana`);
  }

  /**
   * Asocia una rama a un issue de GitHub mediante un comentario en el issue.
   * @param repoUrl - La URL del repositorio donde está el issue.
   * @param issueNumber - El número del issue a asociar con la rama.
   * @param branchName - El nombre de la rama que se asociará al issue.
   */
  async associateBranchWithIssue(
    repoUrl: string,
    issueNumber: number,
    branchName: string,
  ) {
    try {
      await this.executeAssociateBranch(repoUrl, issueNumber, branchName);
      console.log(`Rama ${branchName} asociada con el issue #${issueNumber} en ${this.getRepoName(repoUrl)}`);
    } catch (error) {
      console.error(`Error al asociar la rama con el issue en ${this.getRepoName(repoUrl)}:`, error);
      throw new Error("No se pudo asociar la rama con el issue");
    }
  }

  /**
   * Ejecuta la asociación de rama con issue mediante comentario.
   * @param repoUrl - La URL del repositorio.
   * @param issueNumber - El número del issue.
   * @param branchName - El nombre de la rama.
   */
  private async executeAssociateBranch(repoUrl: string, issueNumber: number, branchName: string): Promise<void> {
    await this.retryWithBackoff(async () => {
      const config: AxiosRequestConfig = {
        headers: this.headers,
        method: "POST",
        url: `${repoUrl}/issues/${issueNumber}/comments`,
        data: {
          body: `La rama ${branchName} ha sido creada para esta tarea y ya se inicio el desarrollo`,
        },
        timeout: 30000,
      };
      return await axios.post(config.url, config.data, config);
    });
  }

  /**
   * Obtiene la URL de clonación de la rama recién creada.
   * @param repoUrl - La URL del repositorio.
   * @returns La URL de clonación del repositorio con la rama específica.
   */
  getCloneUrl(repoUrl: string): string {
    const repoUrlWeb = repoUrl.replace(
      "https://api.github.com/repos",
      "https://github.com",
    );
    return `${repoUrlWeb}.git`;
  }

  /**
   * Ejecuta una función con reintentos automáticos en caso de fallo.
   * @param fn - La función a ejecutar.
   * @param maxRetries - Número máximo de reintentos (por defecto 3).
   * @param delay - Tiempo de espera entre reintentos en ms (por defecto 1000).
   * @returns El resultado de la función ejecutada.
   */
  // eslint-disable-next-line max-lines-per-function
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.warn(`Intento ${attempt}/${maxRetries} falló:`, error.message);
        
        // No reintentar en ciertos tipos de errores
        if (error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403) {
          throw error;
        }
        
        // Si no es el último intento, esperar antes del siguiente
        if (attempt < maxRetries) {
          const backoffDelay = delay * Math.pow(2, attempt - 1); // Backoff exponencial
          console.log(`Esperando ${backoffDelay}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Extrae el nombre del repositorio de una URL de la API de GitHub.
   * @param repoUrl - La URL del repositorio de GitHub API.
   * @returns El nombre del repositorio en formato "owner/repo".
   */
  private getRepoName(repoUrl: string): string {
    const match = repoUrl.match(/https:\/\/api\.github\.com\/repos\/([\w\-]+\/[\w\-]+)/);
    return match ? match[1] : 'unknown-repo';
  }

  /**
   * Actualiza la tarea en Taiga con información de todos los repositorios procesados.
   * @param repositories - Array de repositorios procesados.
   * @param ramaName - Nombre de la rama creada.
   * @param results - Resultados del procesamiento de cada repositorio.
   * @param itemType - Tipo de elemento en Taiga: 'task' o 'userstory'.
   */
  private async updateTaigaWithAllRepos(
    repositories: DataResponseDTO[], 
    ramaName: string, 
    results: string[],
    itemType: 'task' | 'userstory' = 'userstory'
  ): Promise<void> {
    try {
      const fullComment = this.buildTaigaComment(repositories, ramaName, results);
      const finalComment = this.prepareTaigaComment(fullComment);
      
      console.log(`Intentando actualizar Taiga ${itemType} ID: ${repositories[0].data.id}`);
      console.log(`Tamaño del comentario: ${finalComment.length} caracteres`);

      await this.taigaSvc.updateTaigaTask(
        repositories[0].data.id,
        finalComment,
        ramaName,
        itemType,
      );

      console.log(`${itemType === 'task' ? 'Tarea' : 'User Story'} en Taiga actualizada con información de ${repositories.length} repositorio(s)`);
    } catch (error) {
      this.handleTaigaUpdateError(error, repositories[0].data.id);
    }
  }

  /**
   * Prepara el comentario para Taiga limitando su tamaño si es necesario.
   * @param comment - El comentario original.
   * @returns El comentario preparado para enviar a Taiga.
   */
  private prepareTaigaComment(comment: string): string {
    const maxCommentLength = 2000;
    return comment.length > maxCommentLength 
      ? comment.substring(0, maxCommentLength) + '\n\n... (comentario truncado)'
      : comment;
  }

  /**
   * Maneja los errores específicos de actualización de Taiga.
   * @param error - El error ocurrido.
   * @param taskId - ID de la tarea que se intentaba actualizar.
   */
  private handleTaigaUpdateError(error: any, taskId: number): void {
    console.error('Error al actualizar Taiga con información de todos los repos:', error);
    
    if (error.response?.status === 403) {
      console.error('Error 403 - Permisos insuficientes en Taiga:');
      console.error('- Verifica que el token de Taiga sea válido y no haya expirado');
      console.error('- Confirma que el usuario tenga permisos de edición en el proyecto');
      console.error(`- Task ID: ${taskId}`);
      console.error(`- Error details:`, error.response.data);
    }
  }

  /**
   * Construye el comentario para Taiga con información de todos los repositorios.
   * @param repositories - Array de repositorios procesados.
   * @param ramaName - Nombre de la rama creada.
   * @param results - Resultados del procesamiento.
   * @returns El comentario formateado para Taiga.
   */
  private buildTaigaComment(repositories: DataResponseDTO[], ramaName: string, results: string[]): string {
    const repoSummary = repositories.map((repo, index) => {
      const repoName = this.getRepoName(repo.config.url);
      const cloneUrl = this.getCloneUrl(repo.config.url);
      const result = results[index] || 'Sin resultado';
      
      // Determinar el ícono según el resultado
      let icon = '📁';
      if (result.includes('creada y asociada')) {
        icon = '✅';
      } else if (result.includes('Error')) {
        icon = '❌';
      } else if (result.includes('pero no se pudo')) {
        icon = '⚠️';
      }
      
      return `${icon} **${repoName}**\n   - URL: ${cloneUrl}\n   - Rama: ${ramaName}\n   - Estado: ${result}`;
    }).join('\n\n');

    return `🚀 **Desarrollo iniciado en múltiples repositorios**\n\n${repoSummary}\n\n⏰ ${this.appSvc.getFormattedDateTime()} Hora Colombiana`;
  }

  /**
   * Extrae y limpia las URLs de repositorios de GitHub de la descripción.
   * @param description - La descripción que contiene las URLs.
   * @returns Array de URLs únicas de repositorios de GitHub API.
   */
  private extractRepositoryUrls(description: string): string[] {
    // Buscar URLs de la API de GitHub
    const apiUrlRegex = /https:\/\/api\.github\.com\/repos\/[\w\-]+\/[\w\-]+/g;
    const apiUrls = description.match(apiUrlRegex) || [];
    
    // Buscar URLs de GitHub normales y convertirlas a API URLs
    const githubUrlRegex = /https:\/\/github\.com\/([\w\-]+\/[\w\-]+)/g;
    const githubMatches = [...description.matchAll(githubUrlRegex)];
    const convertedUrls = githubMatches.map(match => 
      `https://api.github.com/repos/${match[1]}`
    );
    
    // Combinar todas las URLs y eliminar duplicados
    const allUrls = [...apiUrls, ...convertedUrls];
    const uniqueUrls = [...new Set(allUrls)];
    
    console.log(`📋 URLs encontradas: ${allUrls.length} total, ${uniqueUrls.length} únicas`);
    console.log(`📋 URLs detectadas:`, allUrls);
    console.log(`📋 URLs únicas finales:`, uniqueUrls);
    
    if (allUrls.length !== uniqueUrls.length) {
      console.log(`🔄 Se eliminaron ${allUrls.length - uniqueUrls.length} URL(s) duplicada(s)`);
    }
    
    return uniqueUrls;
  }

  /**
   * Verifica si un repositorio de GitHub existe y es accesible.
   * @param repoUrl - La URL del repositorio a verificar.
   * @returns Promise<boolean> - true si el repositorio existe y es accesible.
   */
  private async verifyRepositoryAccess(repoUrl: string): Promise<boolean> {
    try {
      console.log(`🔍 Verificando acceso al repositorio: ${this.getRepoName(repoUrl)}`);
      
      await this.executeRepositoryCheck(repoUrl);
      
      console.log(`✅ Repositorio ${this.getRepoName(repoUrl)} es accesible`);
      return true;
    } catch (error) {
      this.handleRepositoryAccessError(error, repoUrl);
      return false;
    }
  }

  /**
   * Ejecuta la verificación de acceso al repositorio.
   * @param repoUrl - La URL del repositorio a verificar.
   */
  private async executeRepositoryCheck(repoUrl: string): Promise<void> {
    await this.retryWithBackoff(async () => {
      const config: AxiosRequestConfig = {
        method: "GET",
        headers: this.headers,
        url: repoUrl,
        timeout: 10000,
      };
      return await axios.get(config.url, config);
    });
  }

  /**
   * Maneja los errores de verificación de acceso al repositorio.
   * @param error - El error ocurrido.
   * @param repoUrl - La URL del repositorio.
   */
  private handleRepositoryAccessError(error: any, repoUrl: string): void {
    console.error(`❌ Error al verificar repositorio ${this.getRepoName(repoUrl)}:`, error);
    
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      console.error(`- Mensaje:`, error.response.data);
      
      if (error.response.status === 404) {
        console.error(`- El repositorio ${this.getRepoName(repoUrl)} no existe o no tienes acceso`);
      } else if (error.response.status === 403) {
        console.error(`- Sin permisos para acceder al repositorio ${this.getRepoName(repoUrl)}`);
      }
    }
  }
}
