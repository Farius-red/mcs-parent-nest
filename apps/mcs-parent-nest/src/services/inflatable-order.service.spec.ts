import { ConfigService } from "@nestjs/config";
import axios, { AxiosResponse } from "axios";
import * as ExcelJS from "exceljs";
import { InflatableOrderFormDto } from "../dto/inflatable-order.dto";
import {
  extractProductDimensions,
  InflatableCatalogProduct,
  InflatableCatalogService,
} from "./inflatable-catalog.service";
import {
  generateNextLotCode,
  InflatableOrderService,
  resolveLotPrefix,
} from "./inflatable-order.service";
import { TaigaIssue, TaigaService } from "./taiga/taiga.service";

const formResponse: InflatableOrderFormDto = {
  "Nombres completos ": "Cliente Prueba",
  "Por favor especifique el nombre del inflable": "Minitobogan disney",
  "Tipo de motor ": "Eléctrico 2HP",
  "Los colores de su inflable son iguales a los de la imagen de referencia que concretó con su vendedor ?":
    "Sí",
  "Su inflable lleva impresiones, diseños troquelados(no3d) o muñecos en 3d?":
    "Sí",
  "Sí, su respuesta es no, porfavor especifique los colores y ubicación que desea modificar a su producto.":
    ".",
  "Sí, su inflable lleva impresiones, porfavor especifique cuales personajes, numeros o texto desea junto con la ubicacion, asi como los muñecos 3d o imagenes troqueladas. (sea muy especifico porfavor, si son iguales a los de imagen de referencia escribalo)":
    "Impresión frontal",
};

describe("InflatableOrderService", () => {
  it(
    "increments only matching prefix and current-year lots",
    verifyLotSequence,
  );
  it("extracts dimensions only when the catalog labels them", verifyDimensions);
  it("resolves lot prefixes from category and product name", verifyLotPrefixes);
  it(
    "reads product category and measures from the Excel catalog",
    verifyCatalogLookup,
  );
  it(
    "serializes concurrent lot assignment and creates a Taiga issue",
    verifyConcurrentOrders,
  );
});

afterEach(() => jest.restoreAllMocks());

function verifyLotSequence(): void {
  expect(
    generateNextLotCode(
      "MT",
      ["MT03026 - Cliente", "TOB09926", "MT40025"],
      2026,
    ),
  ).toBe("MT03126");
  expect(generateNextLotCode("CAS", [], 2026)).toBe("CAS00126");
  expect(generateNextLotCode("MC", ["MC99926 - Producto"], 2026)).toBe(
    "MC100026",
  );
}

function verifyDimensions(): void {
  expect(
    extractProductDimensions(
      "MINI TOBOGAN 4.50 ALTO X 4 DE ANCHO X 5 DE FONDO",
    ),
  ).toEqual({
    fondo: "5 m",
    alto: "4.50 m",
    ancho: "4 m",
  });
  expect(extractProductDimensions("2 x 2 METROS").alto).toBe(
    "No especificado en catálogo",
  );
}

function verifyLotPrefixes(): void {
  expect(resolveLotPrefix("Mini Ball Pool", "MINI CASTILLOS")).toBe("MC");
  expect(resolveLotPrefix("Tobogán Disney")).toBe("TOB");
  expect(resolveLotPrefix("Mini tobogán Disney")).toBe("MT");
  expect(resolveLotPrefix("Castillo Aladino", "CASTILLOS")).toBe("CAS");
}

async function verifyCatalogLookup(): Promise<void> {
  const buffer = await createCatalogWorkbook();
  jest.spyOn(axios, "get").mockResolvedValue({
    data: buffer,
  } as unknown as AxiosResponse<ArrayBuffer>);
  const config = {
    get: jest.fn().mockReturnValue("https://catalog.example/catalog.xlsx"),
  } as unknown as ConfigService;
  const service = new InflatableCatalogService(config);

  const product = await service.findProduct("Minitobogan disney");
  expect(product?.category).toBe("MINI TOBOGAN");
  expect(extractProductDimensions(product?.description ?? "").fondo).toBe(
    "5 m",
  );
}

async function createCatalogWorkbook(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Catalogo");
  worksheet.addRow([
    "CATEGORIA",
    "REFERENCIA",
    "NOMBRE PRODUCTO",
    "🏰DESCRIPCION",
  ]);
  worksheet.addRow([
    "MINI TOBOGAN",
    "MTOB25-002",
    "MINI TOBOGAN DISNEY",
    "MINI TOBOGAN 4.50 ALTO X 4 DE ANCHO X 5 DE FONDO",
  ]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function verifyConcurrentOrders(): Promise<void> {
  const context = createOrderContext();
  const results = await Promise.all([
    context.service.createOrder(formResponse),
    context.service.createOrder(formResponse),
  ]);
  const yearSuffix = currentYearSuffix();
  expect(results.map((result) => result.lotCode)).toEqual([
    `MT001${yearSuffix}`,
    `MT002${yearSuffix}`,
  ]);
  expect(context.createIssue).toHaveBeenCalledWith(
    `MT001${yearSuffix} - Cliente Prueba - Minitobogan disney`,
    expect.stringContaining("FONDO:  5 m"),
  );
  expect(context.descriptions[0]).toContain("- MALLA DE SEGURIDAD SUPERIOR.");
}

function currentYearSuffix(): string {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
  }).format(new Date());
  return String(Number(year) % 100).padStart(2, "0");
}

function createOrderContext() {
  const taigaContext = createTaigaContext();
  const catalog = createCatalogMock();
  return {
    service: new InflatableOrderService(taigaContext.taiga, catalog),
    createIssue: taigaContext.createIssue,
    descriptions: taigaContext.descriptions,
  };
}

function createTaigaContext() {
  const issues: TaigaIssue[] = [];
  const descriptions: string[] = [];
  const createIssue = jest.fn(async (subject: string, description: string) => {
    const issue = { id: issues.length + 1, subject };
    issues.push(issue);
    descriptions.push(description);
    return issue;
  });
  return {
    taiga: {
      getProjectIssues: jest.fn(async () => [...issues]),
      createIssue,
    } as unknown as TaigaService,
    createIssue,
    descriptions,
  };
}

function createCatalogMock(): InflatableCatalogService {
  const catalogProduct: InflatableCatalogProduct = {
    category: "MINI TOBOGAN",
    name: "MINI TOBOGAN DISNEY",
    description: "MINI TOBOGAN 4.50 ALTO X 4 DE ANCHO X 5 DE FONDO",
  };
  return {
    findProduct: jest.fn().mockResolvedValue(catalogProduct),
  } as unknown as InflatableCatalogService;
}
