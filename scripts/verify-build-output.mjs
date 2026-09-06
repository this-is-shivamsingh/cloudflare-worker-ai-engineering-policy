/* global console, process */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { findForbiddenBuildPaths } from "./build-output-safety.mjs";

const outputDirectory = resolve(process.argv[2] ?? "dist");

if (!existsSync(outputDirectory)) {
  throw new Error("Build output directory does not exist.");
}

const forbiddenPaths = findForbiddenBuildPaths(outputDirectory);

if (forbiddenPaths.length > 0) {
  throw new Error(`Build output contains ${forbiddenPaths.length} forbidden credential path(s).`);
}

console.log("Build output contains no forbidden credential paths.");
