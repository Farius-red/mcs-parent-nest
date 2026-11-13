import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { AppService } from "../../app.service";
import { TaigaService } from "./taiga.service";

describe("TaigaService issues API", () => {
  afterEach(() => jest.restoreAllMocks());
  it(
    "queries Taiga issues for the configured project, including every page",
    queryProjectIssues,
  );
  it("creates an issue using the Taiga issues endpoint", createIssue);
});

async function queryProjectIssues(): Promise<void> {
  const firstPage = createIssuesPage();
  const post = mockTaigaAuthentication();
  const get = mockIssuePages(firstPage);
  const issues = await createTaigaService().getProjectIssues();
  expect(issues).toHaveLength(100);
  expect(post).toHaveBeenCalledWith(
    "https://api.taiga.io/api/v1/auth",
    expect.objectContaining({ username: "taiga-user" }),
  );
  expectIssuePages(get);
}

async function createIssue(): Promise<void> {
  const post = mockIssueCreation();
  await createTaigaService().createIssue(
    "MT00126 - Cliente - Producto",
    "Descripción",
  );
  expect(post).toHaveBeenNthCalledWith(
    2,
    "https://api.taiga.io/api/v1/issues",
    {
      project: 42,
      subject: "MT00126 - Cliente - Producto",
      description: "Descripción",
    },
    expect.any(Object),
  );
}

function createTaigaService(): TaigaService {
  const values: Record<string, string> = {
    GIT_USER: "taiga-user",
    TIAGA_PASSWORD: "taiga-password",
    TAIGA_PROJECT_ID: "42",
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  return new TaigaService({} as AppService, config);
}

function createIssuesPage(): Array<{
  id: number;
  ref: number;
  subject: string;
}> {
  return Array.from({ length: 100 }, (_, index) => ({
    id: index + 1,
    ref: index + 1,
    subject: `MT${String(index + 1).padStart(3, "0")}26 - Pedido`,
  }));
}

function mockTaigaAuthentication() {
  return jest.spyOn(axios, "post").mockResolvedValue({
    data: { auth_token: "test-token" },
  } as never);
}

function mockIssuePages(firstPage: ReturnType<typeof createIssuesPage>) {
  return jest
    .spyOn(axios, "get")
    .mockResolvedValueOnce({ data: firstPage } as never)
    .mockResolvedValueOnce({ data: [] } as never);
}

function expectIssuePages(get: jest.SpyInstance): void {
  for (const page of [1, 2]) {
    expect(get).toHaveBeenNthCalledWith(
      page,
      "https://api.taiga.io/api/v1/issues",
      expect.objectContaining({
        params: { project: 42, page, page_size: 100 },
      }),
    );
  }
}

function mockIssueCreation() {
  return jest
    .spyOn(axios, "post")
    .mockResolvedValueOnce({ data: { auth_token: "test-token" } } as never)
    .mockResolvedValueOnce({
      data: { id: 8, ref: 28, subject: "MT00126 - Cliente - Producto" },
    } as never);
}
