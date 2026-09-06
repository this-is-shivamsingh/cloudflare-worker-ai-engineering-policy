import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local development configuration", () => {
  it("keeps raw Cloudflare values in an ignored runtime-only file", () => {
    const example = readFileSync(".dev.vars.example", "utf8");
    const gitignore = readFileSync(".gitignore", "utf8");
    const dockerignore = readFileSync(".dockerignore", "utf8");
    const compose = readFileSync("compose.yaml", "utf8");
    const dockerfile = readFileSync("Dockerfile", "utf8");

    expect(example).toContain("DEBUG_AGENT_EVENTS=1");
    expect(example).toContain("CLOUDFLARE_API_TOKEN='replace-with-workers-ai-api-token'");
    expect(example).toContain("CLOUDFLARE_ACCOUNT_ID='replace-with-cloudflare-account-id'");
    expect(gitignore).toMatch(/^\.dev\.vars$/m);
    expect(gitignore).toMatch(/^!\.dev\.vars\.example$/m);
    expect(dockerignore).toMatch(/^\.dev\.vars$/m);
    expect(compose).toContain("source: ./.dev.vars");
    expect(compose).toContain("target: /run/secrets/cloudflare_dev_vars");
    expect(compose).toContain("read_only: true");
    expect(compose).not.toMatch(/env_file|CLOUDFLARE_API_TOKEN_FILE/);
    expect(dockerfile).not.toMatch(/CLOUDFLARE_(API_TOKEN|ACCOUNT_ID)/);
  });

  it("loads a synthetic runtime file without printing its values", () => {
    const directory = mkdtempSync(join(tmpdir(), "policy-copilot-config-"));
    temporaryDirectories.push(directory);
    const varsFile = join(directory, "dev.vars");
    const fakeNpm = join(directory, "npm");

    writeFileSync(
      varsFile,
      "DEBUG_AGENT_EVENTS=1\nCLOUDFLARE_API_TOKEN='fixture-token'\nCLOUDFLARE_ACCOUNT_ID='fixture-account'\n",
      { mode: 0o600 }
    );
    writeFileSync(
      fakeNpm,
      "#!/bin/sh\nset -eu\ntest \"$DEBUG_AGENT_EVENTS\" = 1\ntest \"$CLOUDFLARE_API_TOKEN\" = fixture-token\ntest \"$CLOUDFLARE_ACCOUNT_ID\" = fixture-account\ntest \"$*\" = \"run dev -- --host 0.0.0.0 --port 5173\"\n",
      { mode: 0o700 }
    );
    chmodSync(fakeNpm, 0o700);

    const result = spawnSync("sh", ["scripts/docker-entrypoint.sh"], {
      encoding: "utf8",
      env: {
        CLOUDFLARE_DEV_VARS_FILE: varsFile,
        PATH: `${directory}:/usr/bin:/bin`
      }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("rejects placeholder credentials without printing them", () => {
    const directory = mkdtempSync(join(tmpdir(), "policy-copilot-placeholder-"));
    temporaryDirectories.push(directory);
    const varsFile = join(directory, "dev.vars");

    writeFileSync(
      varsFile,
      "DEBUG_AGENT_EVENTS=1\nCLOUDFLARE_API_TOKEN='replace-with-workers-ai-api-token'\nCLOUDFLARE_ACCOUNT_ID='replace-with-cloudflare-account-id'\n",
      { mode: 0o600 }
    );

    const result = spawnSync("sh", ["scripts/docker-entrypoint.sh"], {
      encoding: "utf8",
      env: {
        CLOUDFLARE_DEV_VARS_FILE: varsFile,
        PATH: "/usr/bin:/bin"
      }
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("CLOUDFLARE_API_TOKEN");
    expect(result.stderr).not.toContain("replace-with-workers-ai-api-token");
    expect(result.stderr).not.toContain("replace-with-cloudflare-account-id");
  });

  it("documents and implements the POSIX debug contract", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const readme = readFileSync("README.md", "utf8");

    expect(packageJson.scripts["dev:debug"]).toBe("DEBUG_AGENT_EVENTS=1 npm run dev");
    expect(packageJson.scripts["dev:debug"]).not.toContain("&&");
    expect(readme).toContain("npm run dev:debug");
    expect(readme).toContain("safe inbound/outbound event metadata");
    expect(readme).toContain("must never log policy source, chat text, prompts, model input/output");
  });
});
