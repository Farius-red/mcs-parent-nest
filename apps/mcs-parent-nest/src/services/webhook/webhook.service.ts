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
      const res = await this.checkActionGit(payload);
      const ramaName = `${res.data.ref}-${res.data.title}`;
      if (res.data.res === "CREATE_ISSUE") {
        return await this.createGithubIssue(
          res.data.title,
          res.data.description,
          res.config.url,
        );
      }
      if (res.data.res === "UPDATE_ISSUE") return await this.manageCreateBranch(res, ramaName);
      
      if (res.data.res === "DELETE_ISSUE")  return await this.closeGithubIssue(res, res.data.title);
       return `No entro a ningun cambio de tarea valido ${this.appSvc.getFormattedDateTime()}`;
    } catch (error) {
      console.error("Error en sendTaskGit:", error);
      return `Algo Salio mal al an enviar Task a Git: ${this.appSvc.getFormattedDateTime()}`;
    }
  }

  /**
   * Maneja la creación de una rama en GitHub y la asociación con un issue de Taiga.
   * Si la rama se crea con éxito, actualiza la tarea en Taiga con la URL para clonar la rama.
   *
   * @param res - Objeto con la configuración de GitHub y datos relacionados con la tarea.
   * @param ramaName - El nombre de la rama a crear.
   * @param payload - El payload para actualizar la tarea en Taiga con la nueva información de la rama.
   *
   * @returns Promesa de la operación de actualización en Taiga si la rama se crea correctamente.
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

      const issueNumber = await this.findGithubIssue(
        res.data.title,
        res.config,
      );

      if (issueNumber) {
        await this.associateBranchWithIssue(
          res.config.url,
          issueNumber,
          ramaName,
        );

        const repoUrlClone = this.getCloneUrl(res.config.url);

        return await this.taigaSvc.updateTaigaTask(
          res.data.id,
          repoUrlClone,
          ramaName,
        );
      } else {
        return `Se creo la Ramma con nombre ${ramaName} pero no se pudo asociar un asunto  en GIT`;
      }
    } catch (error) {
      console.error("Error en manageCreateBranch:", error);
    }
  }

  /**
   * Verifica la acción del webhook y retorna la respuesta correspondiente según el tipo de acción.
   * @param payload - El payload del webhook que contiene la información de la tarea.
   * @returns Un objeto `DataResponseDTO` que contiene la configuración y los datos de la tarea.
   */
  // eslint-disable-next-line max-lines-per-function
  async checkActionGit(payload: any): Promise<DataResponseDTO> {
    if (
      payload.data.description.length > 0 &&
      payload.data.subject.length > 0
    ) {
      const description = payload.data.description;
      const urlRegex = /https:\/\/api\.github\.com\/repos\/[\w\-]+\/[\w\-]+/g;
      const repoUrl = description.match(urlRegex)?.[0];

      if (repoUrl && (payload.type === "userstory" || payload.type === "task")) {
        const response: DataResponseDTO = {
          config: { url: repoUrl },
          data: {
            description: description,
            title: payload.data.subject,
            id: payload.data.id,
            ref: payload.data.ref,
          },
        };

        if (payload.action === "create") response.data.res = "CREATE_ISSUE";
        if (payload.action === "change") {
          if (payload.change.diff.status.to === "In progress")
            response.data.res = "UPDATE_ISSUE";
          if (payload.change.diff.status.to === "Finalizada")
            response.data.res = "DELETE_ISSUE";
        }

        return response;
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
      const updatedConfig = {
        url: `${config.url}/issues?state=open`,
        method: "GET",
        headers: this.headers,
      };
      const response = await axios.get(updatedConfig.url, updatedConfig);
      const issues = response.data;
      const issue = issues.find((issue: any) => issue.title === branchName);

      return issue ? issue.number : null;
    } catch (error) {
      console.error("Error al buscar el issue:", error);
      throw new Error("Error al buscar el issue en GitHub");
    }
  }

  /**
   * Cierra un issue en GitHub utilizando su número del issue.
   * @param branchName - El número de la ramma asociada el issue.
   * @param config - La configuración de la solicitud para acceder al repositorio de GitHub.
   * @returns Un objeto con los datos del issue actualizado o null si no se encuentra.
   */
  async closeGithubIssue(
    config: DataResponseDTO,
    branchName: string,
  ): Promise<any | null> {
    try {
      const issueNumber = await this.findGithubIssue(branchName, config.config);
      const updatedConfig = {
        url: `${config.config.url}/issues/${issueNumber}`,
        method: "PATCH",
        headers: this.headers,
        data: {
          state: "closed",
        },
      };
      await axios.patch(updatedConfig.url, updatedConfig.data, updatedConfig);

      return `Se cerro el issue ${issueNumber} correctamente  ${this.appSvc.getFormattedDateTime()} Hora colombia`;
    } catch (error) {
      console.error("Worservice.closeGithubIssue():", error);
      return ` Error al cerrar issue :  ${this.appSvc.getFormattedDateTime()} Hora colombia `;
    }
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
    const data = { title, body };
    const config: AxiosRequestConfig = {
      url: `${repoUrl}/issues`,
      method: "POST",
      data,
      headers: this.headers,
    };

    try {
      await axios.post(config.url, config.data, config);

      return "Issue creado con éxito en GitHub";
    } catch (error) {
      console.error("Error al crear el issue en GitHub:", error);
      return "Error al crear el issue en GitHub";
    }
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
    const config: AxiosRequestConfig = {
      method: "GET",
      headers: this.headers,
      url: repoUrl,
    };

    try {
      const { data: defaultBranchData } = await this.getLastCommit(config);
      const sha = defaultBranchData.sha;
      const data = { ref: `refs/heads/${branchName.replace(/\s+/g, "")}`, sha };
      const branchConfig: AxiosRequestConfig = {
        headers: this.headers,
        method: "POST",
        timeout: 15000,
      };

      await axios.post(`${repoApiUrl}`, data, branchConfig);
      return `Rama ${branchName} creada con éxito.`;
    } catch (error) {
      console.error("Error al crear la rama:", error);
      if (error.response.data.message === "Reference already exists") {
        return `Error No se pudo crear La rama con nombre ${branchName} porque ya existe en el repo : ${this.appSvc.getFormattedDateTime()} Hora Colombiana`;
      }
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
      return await axios.get(`${config.url}/commits/develop`, config);
    } catch (error) {
      console.error("webhookService.getLasCommit() ", error);
      throw new Error(
        `Error No se pudo obtener el último commit ${this.appSvc.getFormattedDateTime()} Hora Colombiana`,
      );
    }
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
      const config: AxiosRequestConfig = {
        headers: this.headers,
        method: "POST",
        url: `${repoUrl}/issues/${issueNumber}/comments`,
        data: {
          body: `La rama ${branchName} ha sido creada para esta tarea y ya se inicio el desarrollo`,
        },
        timeout: 6000,
      };

      await axios.post(config.url, config.data, config);
      console.log(`Rama ${branchName} asociada con el issue #${issueNumber}`);
    } catch (error) {
      console.error("Error al asociar la rama con el issue:", error);
      throw new Error("No se pudo asociar la rama con el issue");
    }
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
}
