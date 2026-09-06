import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

function createOutputDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "engineering-policy-build-output-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("build output credential safety", () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("removes forbidden credential paths without inspecting their contents", () => {
    const outputDirectory = createOutputDirectory();
    mkdirSync(join(outputDirectory, "client", ".wrangler"), { recursive: true });
    mkdirSync(join(outputDirectory, "client", "assets"), { recursive: true });
    writeFileSync(join(outputDirectory, ".dev.vars"), "");
    writeFileSync(join(outputDirectory, "client", ".env.production"), "");
    writeFileSync(join(outputDirectory, "client", ".wrangler", "state"), "");
    writeFileSync(join(outputDirectory, "client", "assets", "app.js"), "");

    execFileSync(process.execPath, ["scripts/sanitize-build-output.mjs", outputDirectory], {
      cwd: process.cwd(),
      stdio: "pipe"
    });
    execFileSync(process.execPath, ["scripts/verify-build-output.mjs", outputDirectory], {
      cwd: process.cwd(),
      stdio: "pipe"
    });

    expect(existsSync(join(outputDirectory, ".dev.vars"))).toBe(false);
    expect(existsSync(join(outputDirectory, "client", ".env.production"))).toBe(false);
    expect(existsSync(join(outputDirectory, "client", ".wrangler"))).toBe(false);
    expect(existsSync(join(outputDirectory, "client", "assets", "app.js"))).toBe(true);
  });
});
