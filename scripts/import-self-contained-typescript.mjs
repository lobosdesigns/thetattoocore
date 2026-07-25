import { readFile } from "node:fs/promises";
import ts from "typescript";

function hasModuleDependency(sourceFile) {
  let found = false;

  function visit(node) {
    if (found) return;

    if (
      ts.isImportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isImportTypeNode(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
      (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require")))
    ) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

export async function importSelfContainedTypeScript(specifier, parentUrl) {
  const moduleUrl = new URL(specifier, parentUrl);
  const source = await readFile(moduleUrl, "utf8");
  const sourceFile = ts.createSourceFile(
    moduleUrl.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const { diagnostics = [], outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: moduleUrl.pathname,
    reportDiagnostics: true,
  });

  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    const codes = [...new Set(errors.map(({ code }) => `TS${code}`))].join(", ");
    throw new SyntaxError(
      `TypeScript transpilation failed for ${moduleUrl.pathname}: ${codes}`,
    );
  }

  if (hasModuleDependency(sourceFile)) {
    throw new Error(
      `Test module must be self-contained: ${moduleUrl.pathname}`,
    );
  }

  const moduleSource = `${outputText}\n//# sourceURL=${moduleUrl.href}\n`;
  const encodedSource = Buffer.from(moduleSource, "utf8").toString("base64");

  return import(`data:text/javascript;base64,${encodedSource}`);
}
