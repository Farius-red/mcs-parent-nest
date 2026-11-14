import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InflatableOrderFormDto } from "../dto/inflatable-order.dto";
import {
  extractProductDimensions,
  InflatableCatalogProduct,
  InflatableCatalogService,
} from "./inflatable-catalog.service";
import { TaigaIssue, TaigaService } from "./taiga/taiga.service";

const FORM_FIELDS = {
  client: ["Nombres completos", "nombresCompletos", "nombreCliente"],
  product: [
    "Por favor especifique el nombre del inflable",
    "producto",
    "nombreProducto",
  ],
  motor: ["Tipo de motor", "tipoMotor"],
  sameColors: [
    "Los colores de su inflable son iguales a los de la imagen de referencia que concretó con su vendedor ?",
    "coloresIgualesReferencia",
  ],
  colorDetails: [
    "Sí, su respuesta es no, porfavor especifique los colores y ubicación que desea modificar a su producto.",
    "modificacionesColor",
  ],
  hasPrints: [
    "Su inflable lleva impresiones, diseños troquelados(no3d) o muñecos en 3d?",
    "llevaImpresiones",
  ],
  printDetails: [
    "Sí, su inflable lleva impresiones, porfavor especifique cuales personajes, numeros o texto desea junto con la ubicacion, asi como los muñecos 3d o imagenes troqueladas. (sea muy especifico porfavor, si son iguales a los de imagen de referencia escribalo)",
    "detallesImpresiones",
  ],
};

interface NormalizedOrder {
  client: string;
  product: string;
  motor: string;
  colors: string;
  printDetails: string;
}

export interface InflatableOrderResult {
  lotCode: string;
  subject: string;
  issueId: number;
  issueRef?: number;
}

const ORDER_DESCRIPTION_TEMPLATE = `MOTOR: {{motor}}
BASE DEL DISEÑO: {{product}}
MEDIDAS:
FONDO:  {{fondo}}
ALTO: {{alto}}
ANCHO:  {{ancho}}
COLORES TELA DE ENCIMA: {{colors}}
CAUCHO:
IMPRESIONES: {{printDetails}}
ADICIONALES:
ELEMENTOS OBLIGATORIOS:
- MALLA EN PUERTA DE ENTRADA CON CIERRE INFERIOR.
- MALLA DE SEGURIDAD SUPERIOR.
- ANCLAJES A PISO Y AEREOS.
- MALETAS EN HR1000.`;

@Injectable()
export class InflatableOrderService {
  private readonly logger = new Logger(InflatableOrderService.name);
  private sequenceQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly taigaService: TaigaService,
    private readonly catalogService: InflatableCatalogService,
  ) {}

  /**
   * Convierte la respuesta del formulario en un issue de producción en Taiga.
   *
   * @param payload Respuestas originales de Google Forms por título de pregunta.
   * @returns Código de lote e identificadores del issue creado.
   */
  async createOrder(
    payload: InflatableOrderFormDto,
  ): Promise<InflatableOrderResult> {
    const order = this.normalizeOrder(payload);
    const catalogProduct = await this.catalogService.findProduct(order.product);
    this.logger.log(
      `Catalog lookup completed: matched=${Boolean(catalogProduct)}, category=${catalogProduct?.category ?? "not found"}`,
    );
    const prefix = resolveLotPrefix(order.product, catalogProduct?.category);
    const result = await this.withSequenceLock(() =>
      this.createTaigaIssue(order, catalogProduct, prefix),
    );
    this.logger.log(
      `Inflatable order issue created: lotCode=${result.lotCode}, issueId=${result.issueId}, issueRef=${result.issueRef ?? "unknown"}`,
    );
    return result;
  }

  private normalizeOrder(payload: InflatableOrderFormDto): NormalizedOrder {
    this.validatePayload(payload);
    return {
      client: this.getRequiredField(payload, FORM_FIELDS.client),
      product: this.getRequiredField(payload, FORM_FIELDS.product),
      motor: readFormField(payload, FORM_FIELDS.motor) || "No especificado",
      colors: this.resolveColors(
        readFormField(payload, FORM_FIELDS.sameColors),
        readFormField(payload, FORM_FIELDS.colorDetails),
      ),
      printDetails: this.resolvePrintDetails(
        readFormField(payload, FORM_FIELDS.hasPrints),
        readFormField(payload, FORM_FIELDS.printDetails),
      ),
    };
  }

  private validatePayload(payload: InflatableOrderFormDto): void {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException(
        "El cuerpo debe contener respuestas del formulario",
      );
    }
    if (
      !readFormField(payload, FORM_FIELDS.client) ||
      !readFormField(payload, FORM_FIELDS.product)
    ) {
      throw new BadRequestException(
        "El formulario debe incluir nombres completos y el nombre del inflable",
      );
    }
  }

  private getRequiredField(
    payload: InflatableOrderFormDto,
    fields: string[],
  ): string {
    const value = readFormField(payload, fields);
    if (!value) {
      throw new BadRequestException("Falta un dato obligatorio del formulario");
    }
    return value;
  }

  private resolveColors(sameColors: string, details: string): string {
    if (!isPlaceholder(details)) {
      return details;
    }
    return isAffirmative(sameColors)
      ? "Según imagen de referencia acordada con el vendedor"
      : "No especificado por el cliente";
  }

  private resolvePrintDetails(answer: string, details: string): string {
    if (!isPlaceholder(details)) {
      return details;
    }
    return isAffirmative(answer)
      ? "Sí, especificaciones pendientes"
      : "No aplica";
  }

  private async createTaigaIssue(
    order: NormalizedOrder,
    catalogProduct: InflatableCatalogProduct | null,
    prefix: string,
  ): Promise<InflatableOrderResult> {
    const issues = await this.taigaService.getProjectIssues();
    const lotCode = generateNextLotCode(
      prefix,
      issues.map((issue) => issue.subject),
      getCurrentBusinessYear(),
    );
    const subject = `${lotCode} - ${order.client} - ${order.product}`;
    const description = this.buildDescription(order, catalogProduct);
    const created = await this.taigaService.createIssue(subject, description);
    return this.buildResult(lotCode, subject, created);
  }

  private buildDescription(
    order: NormalizedOrder,
    catalogProduct: InflatableCatalogProduct | null,
  ): string {
    const dimensions = extractProductDimensions(
      catalogProduct?.description ?? "",
    );
    return ORDER_DESCRIPTION_TEMPLATE.replace("{{motor}}", () => order.motor)
      .replace("{{product}}", () => order.product)
      .replace("{{fondo}}", () => dimensions.fondo)
      .replace("{{alto}}", () => dimensions.alto)
      .replace("{{ancho}}", () => dimensions.ancho)
      .replace("{{colors}}", () => order.colors)
      .replace("{{printDetails}}", () => order.printDetails);
  }

  private buildResult(
    lotCode: string,
    subject: string,
    created: TaigaIssue,
  ): InflatableOrderResult {
    return {
      lotCode,
      subject,
      issueId: created.id,
      issueRef: created.ref,
    };
  }

  private withSequenceLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.sequenceQueue;
    let release: () => void;
    this.sequenceQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(operation).finally(() => release());
  }
}

/**
 * Asigna el prefijo del lote a partir de la categoría del catálogo o del nombre recibido.
 *
 * @param productName Producto escrito por el cliente.
 * @param catalogCategory Categoría opcional del catálogo interno.
 * @returns Prefijo del lote.
 * @throws BadRequestException Si no se puede clasificar el tipo de inflable.
 */
export function resolveLotPrefix(
  productName: string,
  catalogCategory?: string,
): "MT" | "TOB" | "MC" | "CAS" {
  const category = normalizeLabel(catalogCategory ?? "");
  const searchable = category || normalizeLabel(productName);
  const rules: Array<[RegExp, "MT" | "TOB" | "MC" | "CAS"]> = [
    [/MINI TOBOGAN/, "MT"],
    [/TOBOGAN/, "TOB"],
    [/MINI CASTILLO/, "MC"],
    [/CASTILLO/, "CAS"],
  ];
  const matchedPrefix = rules.find(([pattern]) =>
    pattern.test(searchable),
  )?.[1];
  if (!matchedPrefix) {
    throw new BadRequestException(
      "No se pudo determinar el tipo de inflable para generar el lote",
    );
  }
  return matchedPrefix;
}

/**
 * Calcula el siguiente código del año actual sin perder ceros iniciales ni ignorar prefijos.
 *
 * @param prefix Prefijo del tipo de producto.
 * @param subjects Títulos de issues existentes en el proyecto.
 * @param year Año de cuatro dígitos que define el sufijo del lote.
 * @returns Código de lote consecutivo con sufijo anual de dos dígitos.
 */
export function generateNextLotCode(
  prefix: string,
  subjects: string[],
  year: number,
): string {
  const yearSuffix = String(year % 100).padStart(2, "0");
  const pattern = new RegExp(
    `(?:^|[^A-Z0-9])${prefix}(\\d{3,})${yearSuffix}(?=$|[^A-Z0-9])`,
    "i",
  );
  const maxSequence = subjects.reduce((maximum, subject) => {
    const match = subject.match(pattern);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}${yearSuffix}`;
}

function getCurrentBusinessYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      year: "numeric",
    }).format(new Date()),
  );
}

function readFormField(
  payload: InflatableOrderFormDto,
  candidates: string[],
): string {
  const candidateKeys = new Set(candidates.map(normalizeLabel));
  const entry = Object.entries(payload).find(([key]) =>
    candidateKeys.has(normalizeLabel(key)),
  );
  const value = entry?.[1];
  if (Array.isArray(value)) {
    return value.map(String).join(", ").trim();
  }
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/MINITOBOGAN/g, "MINI TOBOGAN")
    .replace(/MINICASTILLO/g, "MINI CASTILLO")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function isAffirmative(value: string): boolean {
  return (
    normalizeLabel(value) === "SI" || normalizeLabel(value).startsWith("SI ")
  );
}

function isPlaceholder(value: string): boolean {
  return ["", "N A", "NA", "NO APLICA", "NO", "NINGUNO", "."].includes(
    normalizeLabel(value),
  );
}
