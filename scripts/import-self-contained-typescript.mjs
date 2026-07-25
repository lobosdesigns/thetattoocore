import { readFile } from "node:fs/promises";
import ts from "typescript";

function isTypeOnlyImportDeclaration(node) {
  const importClause = node.importClause;
  if (!importClause) return false;
  if (importClause.isTypeOnly) return true;
  if (importClause.name) return false;

  const namedBindings = importClause.namedBindings;
  return (
    !!namedBindings &&
    ts.isNamedImports(namedBindings) &&
    namedBindings.elements.length > 0 &&
    namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function unsupportedConstructName(node, evalAliases) {
  if (ts.isImportDeclaration(node)) {
    return isTypeOnlyImportDeclaration(node) ? null : "static import";
  }
  if (ts.isImportEqualsDeclaration(node)) return "import equals";
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    !node.isTypeOnly
  ) {
    return "runtime re-export";
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    return "dynamic import";
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require"
  ) {
    return "require";
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    (node.expression.text === "eval" || evalAliases.has(node.expression.text))
  ) {
    return node.expression.text === "eval" ? "eval" : "aliased eval";
  }
  if (
    ts.isCallExpression(node) &&
    ts.isParenthesizedExpression(node.expression) &&
    ts.isBinaryExpression(node.expression.expression) &&
    node.expression.expression.operatorToken.kind === ts.SyntaxKind.CommaToken &&
    ts.isIdentifier(node.expression.expression.right) &&
    node.expression.expression.right.text === "eval"
  ) {
    return "indirect eval";
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "Function"
  ) {
    return "Function constructor";
  }
  if (
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "Function"
  ) {
    return "new Function";
  }

  return null;
}

function collectEvalAliases(sourceFile) {
  const aliases = new Set();

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === "eval"
    ) {
      aliases.add(node.name.text);
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      ts.isIdentifier(node.right) &&
      node.right.text === "eval"
    ) {
      aliases.add(node.left.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return aliases;
}

function findUnsupportedConstruct(sourceFile) {
  const evalAliases = collectEvalAliases(sourceFile);
  let found = null;

  function visit(node) {
    if (found) return;

    const name = unsupportedConstructName(node, evalAliases);
    if (name) {
      found = name;
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

  const unsupportedConstruct = findUnsupportedConstruct(sourceFile);
  if (unsupportedConstruct) {
    throw new Error(
      `Test module must be self-contained: ${moduleUrl.pathname}. Unsupported ${unsupportedConstruct}; self-contained test modules may not use runtime dynamic-code execution or runtime dependency loading.`,
    );
  }

  const moduleSource = `${outputText}\n//# sourceURL=${moduleUrl.href}\n`;
  const encodedSource = Buffer.from(moduleSource, "utf8").toString("base64");

  return import(`data:text/javascript;base64,${encodedSource}`);
}