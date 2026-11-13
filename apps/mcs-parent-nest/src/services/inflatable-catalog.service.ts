import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import * as ExcelJS from "exceljs";

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
    this.validateCatalogUrl(catalogUrl);

    try {
      const response = await axios.get<ArrayBuffer>(catalogUrl, {
        responseType: "arraybuffer",
        timeout: 20000,
      });
      return await this.parseWorkbook(Buffer.from(response.data));
    } catch (error) {
      this.logger.error(
        "No fue posible descargar o leer el Excel del catálogo",
        error,
      );
      throw new BadGatewayException(
        "No fue posible consultar el catálogo de inflables",
      );
    }
  }

  private validateCatalogUrl(catalogUrl: string | undefined): void {
    if (!catalogUrl) {
      throw new InternalServerErrorException(
        "Falta configurar INFLATABLE_CATALOG_URL con la URL pública del Excel",
      );
    }
    if (new URL(catalogUrl).protocol !== "https:") {
      throw new InternalServerErrorException(
        "INFLATABLE_CATALOG_URL debe utilizar HTTPS",
      );
    }
  }

  private async parseWorkbook(
    buffer: Buffer,
  ): Promise<InflatableCatalogProduct[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("El Excel no contiene una hoja de catálogo");
    }

    const columns = this.findCatalogColumns(worksheet.getRow(1));
    return this.readCatalogRows(worksheet, columns);
  }

  private findCatalogColumns(headerRow: ExcelJS.Row): {
    category: number;
    name: number;
    description: number;
  } {
    const headers = new Map<string, number>();
    headerRow.eachCell((cell, column) => {
      headers.set(normalizeText(cell.text), column);
    });

    const category = this.findHeaderColumn(headers, "CATEGORIA");
    const name = this.findHeaderColumn(headers, "NOMBRE PRODUCTO");
    const description = this.findHeaderColumn(headers, "DESCRIPCION");
    if (!category || !name || !description) {
      throw new Error(
        "El Excel no contiene las columnas de categoría, nombre y descripción",
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

  private readCatalogRows(
    worksheet: ExcelJS.Worksheet,
    columns: { category: number; name: number; description: number },
  ): InflatableCatalogProduct[] {
    let category = "";
    const products: InflatableCatalogProduct[] = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const product = this.readCatalogRow(
        worksheet.getRow(rowNumber),
        columns,
        category,
      );
      category = product.category;
      if (product.name) {
        products.push(product);
      }
    }
    this.validateCatalogRows(products);
    return products;
  }

  private readCatalogRow(
    row: ExcelJS.Row,
    columns: { category: number; name: number; description: number },
    previousCategory: string,
  ): InflatableCatalogProduct {
    return {
      category: row.getCell(columns.category).text.trim() || previousCategory,
      name: row.getCell(columns.name).text.trim(),
      description: row.getCell(columns.description).text.trim(),
    };
  }

  private validateCatalogRows(products: InflatableCatalogProduct[]): void {
    if (products.length === 0) {
      throw new Error("El Excel del catálogo no contiene productos");
    }
  }
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
