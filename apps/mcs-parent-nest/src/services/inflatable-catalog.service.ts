import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosResponse } from "axios";

export interface InflatableCatalogProduct {
  category: string;
  name: string;
  description: string;
}

export interface ProductDimensions {
  fondo: string;
  alto: string;
  ancho: string;
}

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const UNKNOWN_DIMENSION = "No especificado en catálogo";
const DIMENSION_NUMBER = "(\\d+(?:[.,]\\d+)?)";

@Injectable()
export class InflatableCatalogService {
  private readonly logger = new Logger(InflatableCatalogService.name);
  private catalogCache: {
    products: InflatableCatalogProduct[];
    expiresAt: number;
  } | null = null;
  private catalogLoad: Promise<InflatableCatalogProduct[]> | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Encuentra el producto más probable del catálogo sin aceptar empates ambiguos.
   *
   * @param productName Nombre tal como lo escribió el cliente en el formulario.
   * @returns Producto coincidente o null cuando no hay coincidencia confiable.
   */
  async findProduct(
    productName: string,
  ): Promise<InflatableCatalogProduct | null> {
    const products = await this.getCatalog();
    const normalizedName = normalizeProductName(productName);
    const exactMatch = products.find(
      (product) => normalizeProductName(product.name) === normalizedName,
    );
    if (exactMatch) {
      return exactMatch;
    }

    return findBestCatalogMatch(normalizedName, products);
  }

  private getCatalog(): Promise<InflatableCatalogProduct[]> {
    if (this.catalogCache && Date.now() < this.catalogCache.expiresAt) {
      return Promise.resolve(this.catalogCache.products);
    }
    if (!this.catalogLoad) {
      this.catalogLoad = this.fetchCatalog()
        .then((products) => {
          this.catalogCache = {
            products,
            expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
          };
          return products;
        })
        .finally(() => {
          this.catalogLoad = null;
        });
    }
    return this.catalogLoad;
  }

  private async fetchCatalog(): Promise<InflatableCatalogProduct[]> {
    const catalogUrl = this.configService.get<string>("INFLATABLE_CATALOG_URL");
    const sheetCsvUrl = this.validateCatalogUrl(catalogUrl);
    try {
      const response = await axios.get<string>(sheetCsvUrl, {
        responseType: "text",
        timeout: 20000,
        validateStatus: () => true,
      });
      return await this.parseCatalogResponse(response);
    } catch (error) {
      this.logCatalogFailure(error);
      throw new BadGatewayException(
        "No fue posible consultar el catálogo de inflables",
      );
    }
  }

  private async parseCatalogResponse(
    response: AxiosResponse<string>,
  ): Promise<InflatableCatalogProduct[]> {
    const csv = response.data.replace(/^\uFEFF/, "");
    const contentType = response.headers["content-type"] ?? "unknown";
    this.logger.log(
      `Google Sheets response: status=${response.status}, contentType=${contentType}, characters=${csv.length}`,
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Google Sheets respondió HTTP ${response.status}; verifica que la hoja permita lectura pública`,
      );
    }
    return this.parseCsvCatalog(csv);
  }

  private parseCsvCatalog(csv: string): InflatableCatalogProduct[] {
    const rows = parseCsvRows(csv);
    const columns = this.findCatalogColumns(rows[0] ?? []);
    let category = "";
    const products = rows.slice(1).flatMap((row) => {
      const product = this.readCatalogRow(row, columns, category);
      category = product.category;
      return product.name ? [product] : [];
    });
    this.validateCatalogRows(products);
    return products;
  }

  private logCatalogFailure(error: unknown): void {
    const reason = axios.isAxiosError(error)
      ? `Fallo de red (${error.code ?? "sin código"})`
      : error instanceof Error
        ? error.message
        : "Error desconocido";
    this.logger.error(`No fue posible consultar la hoja de Google Sheets: ${reason}`);
  }

  private validateCatalogUrl(catalogUrl: string | undefined): string {
    if (!catalogUrl) {
      throw new InternalServerErrorException(
        "Falta configurar INFLATABLE_CATALOG_URL con la URL pública de Google Sheets",
      );
    }
    return buildGoogleSheetsCsvUrl(catalogUrl);
  }

  private findCatalogColumns(headerRow: string[]): {
    category: number;
    name: number;
    description: number;
  } {
    const headers = new Map<string, number>();
    headerRow.forEach((header, index) => {
      headers.set(normalizeText(header), index);
    });

    const category = this.findHeaderColumn(headers, "CATEGORIA");
    const name = this.findHeaderColumn(headers, "NOMBRE PRODUCTO");
    const description = this.findHeaderColumn(headers, "DESCRIPCION");
    if (category === undefined || name === undefined || description === undefined) {
      throw new Error(
        "La hoja no contiene las columnas de categoría, nombre y descripción",
      );
    }
    return { category, name, description };
  }

  private findHeaderColumn(
    headers: Map<string, number>,
    expected: string,
  ): number | undefined {
    return [...headers.entries()].find(([header]) =>
      header.includes(expected),
    )?.[1];
  }

  private readCatalogRow(
    row: string[],
    columns: { category: number; name: number; description: number },
    previousCategory: string,
  ): InflatableCatalogProduct {
    return {
      category: row[columns.category]?.trim() || previousCategory,
      name: row[columns.name]?.trim() ?? "",
      description: row[columns.description]?.trim() ?? "",
    };
  }

  private validateCatalogRows(products: InflatableCatalogProduct[]): void {
    if (products.length === 0) {
      throw new Error("El Excel del catálogo no contiene productos");
    }
  }
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  const expression = /(^|,|\r?\n)(?:"((?:[^"]|"")*)"|([^",\r\n]*))/g;
  for (const match of csv.matchAll(expression)) {
    if (match[1].endsWith("\n")) {
      rows.push(row);
      row = [];
    }
    row.push((match[2] ?? match[3] ?? "").replace(/""/g, '"'));
  }
  if (row.length) rows.push(row);
  return rows.filter((values) => values.some((value) => value.trim()));
}

function buildGoogleSheetsCsvUrl(catalogUrl: string): string {
  const sheetUrl = new URL(catalogUrl);
  if (sheetUrl.protocol !== "https:" || sheetUrl.hostname !== "docs.google.com") {
    throw new InternalServerErrorException(
      "INFLATABLE_CATALOG_URL debe ser una URL HTTPS de docs.google.com",
    );
  }
  const spreadsheetId = sheetUrl.pathname.match(/^\/spreadsheets\/d\/([^/]+)/)?.[1];
  if (!spreadsheetId) {
    throw new InternalServerErrorException(
      "INFLATABLE_CATALOG_URL debe apuntar a una hoja de Google Sheets",
    );
  }
  const gid =
    sheetUrl.searchParams.get("gid") ??
    new URLSearchParams(sheetUrl.hash.slice(1)).get("gid") ??
    "0";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
}

/**
 * Normaliza nombres y corrige la variante de escritura observada en las respuestas del formulario.
 *
 * @param value Texto de producto o de catálogo.
 * @returns Texto sin tildes y con espacios normalizados.
 */
export function normalizeProductName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/MINI\s*TOB(?:O|A)GAN/g, "MINI TOBOGAN")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Selecciona la coincidencia única con mayor solapamiento de palabras.
 *
 * @param normalizedName Nombre ya normalizado del producto solicitado.
 * @param products Productos leídos del catálogo.
 * @returns Coincidencia confiable o null.
 */
export function findBestCatalogMatch(
  normalizedName: string,
  products: InflatableCatalogProduct[],
): InflatableCatalogProduct | null {
  const requestedTokens = new Set(normalizedName.split(" ").filter(Boolean));
  const ranked = products
    .map((product) => ({
      product,
      score: tokenSimilarity(
        requestedTokens,
        new Set(normalizeProductName(product.name).split(" ").filter(Boolean)),
      ),
    }))
    .sort((left, right) => right.score - left.score);
  if (ranked[0]?.score < 0.78 || ranked[0]?.score === ranked[1]?.score) {
    return null;
  }
  return ranked[0]?.product ?? null;
}

/**
 * Extrae medidas solo cuando la descripción las asocia explícitamente a una dimensión.
 *
 * @param description Texto técnico del producto en el catálogo.
 * @returns Medidas en metros o una indicación explícita de dato no disponible.
 */
export function extractProductDimensions(
  description: string,
): ProductDimensions {
  return {
    fondo: readDimension(description, ["FONDO", "LARGO"]),
    alto: readDimension(description, ["ALTO", "ALTURA"]),
    ancho: readDimension(description, ["ANCHO"]),
  };
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  const intersection = [...left].filter((token) => right.has(token)).length;
  return (2 * intersection) / (left.size + right.size);
}

function readDimension(description: string, labels: string[]): string {
  const normalized = normalizeDescription(description);
  for (const label of labels) {
    const value = findDimensionValue(normalized, label);
    if (value) {
      return `${value.replace(",", ".")} m`;
    }
  }
  return UNKNOWN_DIMENSION;
}

function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/(\d)\s+([.,])\s*(\d)/g, "$1$2$3");
}

function findDimensionValue(
  description: string,
  label: string,
): string | undefined {
  const valueBeforeLabel = description.match(
    new RegExp(
      `${DIMENSION_NUMBER}\\s*(?:(?:METROS?|MTS?\\.?)\\s*)?(?:DE\\s*)?${label}\\b`,
    ),
  );
  const valueAfterLabel = description.match(
    new RegExp(`\\b${label}\\s*(?:DE\\s*)?${DIMENSION_NUMBER}`),
  );
  return valueBeforeLabel?.[1] ?? valueAfterLabel?.[1];
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
