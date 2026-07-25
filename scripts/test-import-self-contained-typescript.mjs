import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const testRoot = await mkdtemp(join(tmpdir(), "ttc-typescript-loader-"));
const fixtureDirectory = join(testRoot, "module fixtures");
const parentUrl = pathToFileURL(
  join(fixtureDirectory, "test-entry.mjs"),
).href;

async function writeFixture(name, source) {
  const path = join(fixtureDirectory, name);
  await writeFile(path, source, "utf8");
  return path;
}

try {
  await mkdir(fixtureDirectory);

  const validPath = await writeFixture(
    "valid.ts",
    "export const value: number = 1;\n",
  );
  const first = await importSelfContainedTypeScript(
    "./valid.ts",
    parentUrl,
  );
  const repeated = await importSelfContainedTypeScript(
    "./valid.ts",
    parentUrl,
  );

  assert.equal(first.value, 1);
  assert.strictEqual(repeated, first);

  await writeFile(validPath, "export const value: number = 2;\n", "utf8");
  const changed = await importSelfContainedTypeScript(
    "./valid.ts",
    parentUrl,
  );

  assert.equal(changed.value, 2);
  assert.notStrictEqual(changed, first);

  await writeFixture("invalid.ts", "export const value: = 1;\n");
  await assert.rejects(
    importSelfContainedTypeScript("./invalid.ts", parentUrl),
    /TypeScript transpilation failed/,
  );

  for (const [name, source] of [
    [
      "static-import.ts",
      'import { basename } from "node:path"; export { basename };\n',
    ],
    [
      "re-export.ts",
      'export { basename } from "node:path";\n',
    ],
    [
      "dynamic-import.ts",
      'export const dependency = import("node:path");\n',
    ],
  ]) {
    await writeFixture(name, source);
    await assert.rejects(
      importSelfContainedTypeScript(`./${name}`, parentUrl),
      /Test module must be self-contained/,
    );
  }

  console.log(
    "PASS self-contained TypeScript loader rejects invalid or dependent modules",
  );
} finally {
  await rm(testRoot, { force: true, recursive: true });
}
