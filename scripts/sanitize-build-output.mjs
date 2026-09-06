/* global console, process */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { removeForbiddenBuildPaths } from "./build-output-safety.mjs";

const outputDirectory = resolve(process.argv[2] ?? "dist");

if (!existsSync(outputDirectory)) {
  throw new Error("Build output directory does not exist.");
}

const removedCount = removeForbiddenBuildPaths(outputDirectory);
console.log(`Build output sanitizer removed ${removedCount} forbidden path(s).`);
