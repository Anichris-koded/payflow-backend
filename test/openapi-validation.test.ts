import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import SwaggerParser from "@apidevtools/swagger-parser";
import { apiSchema } from "../src/lib/schema.ts";

test("the generated OpenAPI document validates against the OpenAPI specification", async () => {
  const directory = await mkdtemp(join(tmpdir(), "payflow-openapi-"));
  const path = join(directory, "api-schema.json");
  try {
    await writeFile(path, JSON.stringify(apiSchema({})), "utf8");
    await SwaggerParser.validate(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
