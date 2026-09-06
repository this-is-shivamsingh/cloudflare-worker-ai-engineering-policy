import { readdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

const forbiddenBasenamePatterns = [
  /^\.dev\.vars(?:\..+)?$/,
  /^\.env(?:\..+)?$/,
  /^wrangler-oauth.*$/,
  /^cloudflare-api-token.*$/,
  /(?:^|[-_.])(?:token|credential)s?(?:$|[-_.])/i,
  /\.(?:pem|key|token)$/i
];

const forbiddenDirectoryNames = new Set([".cloudflare", ".config", ".wrangler"]);

export function isForbiddenBuildPath(pathFromOutputRoot) {
  return pathFromOutputRoot.split("/").some((segment) =>
    forbiddenDirectoryNames.has(segment) || forbiddenBasenamePatterns.some((pattern) => pattern.test(segment))
  );
}

export function listBuildOutputPaths(outputDirectory) {
  const paths = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const pathFromOutputRoot = relative(outputDirectory, absolutePath).split("\\").join("/");
      paths.push({ absolutePath, pathFromOutputRoot, isDirectory: entry.isDirectory() });
      if (entry.isDirectory()) visit(absolutePath);
    }
  };

  visit(outputDirectory);
  return paths;
}

export function findForbiddenBuildPaths(outputDirectory) {
  return listBuildOutputPaths(outputDirectory)
    .filter(({ pathFromOutputRoot }) => isForbiddenBuildPath(pathFromOutputRoot))
    .map(({ pathFromOutputRoot }) => pathFromOutputRoot);
}

export function removeForbiddenBuildPaths(outputDirectory) {
  const forbiddenEntries = listBuildOutputPaths(outputDirectory)
    .filter(({ pathFromOutputRoot }) => isForbiddenBuildPath(pathFromOutputRoot))
    .sort((left, right) => right.absolutePath.length - left.absolutePath.length);

  for (const { absolutePath } of forbiddenEntries) {
    rmSync(absolutePath, { force: true, recursive: true });
  }

  return forbiddenEntries.length;
}
