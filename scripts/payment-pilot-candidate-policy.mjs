import ts from "typescript";

export const paymentPilotCandidateSourcePaths = {
  bookingCheckoutSource: "src/app/api/bookings/checkout/route.ts",
  commerceLaunchSource: "src/lib/commerce-launch.ts",
  envExampleSource: ".env.example",
  merchCheckoutSource: "src/app/api/merch/checkout/route.ts",
  releaseGatesSource: "src/lib/stripe/release-gates.ts",
  stripeConnectOnboardingSource:
    "src/app/api/stripe/connect/onboarding/route.ts",
};

export function readPaymentPilotCandidateSources(candidate, readCandidateFile) {
  return Object.fromEntries(
    Object.entries(paymentPilotCandidateSourcePaths).map(([key, path]) => [
      key,
      readCandidateFile(candidate, path),
    ]),
  );
}

function descendants(node, predicate) {
  const matches = [];

  function visit(current) {
    if (predicate(current)) matches.push(current);
    ts.forEachChild(current, visit);
  }

  visit(node);
  return matches;
}

function stripParentheses(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function isIdentifier(node, name) {
  return ts.isIdentifier(stripParentheses(node)) && stripParentheses(node).text === name;
}

function isProductProperty(node, property) {
  const current = stripParentheses(node);
  return (
    ts.isPropertyAccessExpression(current) &&
    isIdentifier(current.expression, "product") &&
    current.name.text === property
  );
}

function isNegationOf(node, predicate) {
  const current = stripParentheses(node);
  return (
    ts.isPrefixUnaryExpression(current) &&
    current.operator === ts.SyntaxKind.ExclamationToken &&
    predicate(current.operand)
  );
}

function isOfficialNonShippingCondition(node) {
  const current = stripParentheses(node);
  if (
    !ts.isBinaryExpression(current) ||
    current.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return false;
  }

  const shippingComparison = stripParentheses(current.right);
  return (
    isProductProperty(current.left, "is_official") &&
    ts.isBinaryExpression(shippingComparison) &&
    shippingComparison.operatorToken.kind ===
      ts.SyntaxKind.ExclamationEqualsEqualsToken &&
    isProductProperty(shippingComparison.left, "shipping_required") &&
    shippingComparison.right.kind === ts.SyntaxKind.TrueKeyword
  );
}

function hasGuaranteedReturn(node) {
  const current = stripParentheses(node);
  if (ts.isReturnStatement(current)) return true;
  if (!ts.isBlock(current)) return false;

  return current.statements.some(ts.isReturnStatement);
}

function callName(node) {
  if (!ts.isCallExpression(node)) return null;
  const expression = stripParentheses(node.expression);
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function statementContainsCall(statement, names) {
  return descendants(
    statement,
    (node) => ts.isCallExpression(node) && names.has(callName(node)),
  ).length > 0;
}

function findFunctionBody(sourceFile, name) {
  const declaration = descendants(
    sourceFile,
    (node) =>
      ts.isFunctionDeclaration(node) &&
      Boolean(node.name) &&
      node.name.text === name &&
      Boolean(node.body),
  )[0];

  return declaration?.body ?? null;
}

function stringArgument(call, index) {
  const argument = call.arguments[index];
  return argument && ts.isStringLiteral(argument) ? argument.text : null;
}

function isShippingCountrySet(node, index, country) {
  if (!ts.isCallExpression(node)) return false;
  const expression = stripParentheses(node.expression);
  return (
    ts.isPropertyAccessExpression(expression) &&
    isIdentifier(expression.expression, "body") &&
    expression.name.text === "set" &&
    stringArgument(node, 0) ===
      `shipping_address_collection[allowed_countries][${index}]` &&
    stringArgument(node, 1) === country
  );
}

function directExpressionCall(statement, predicate) {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isCallExpression(statement.expression) &&
    predicate(statement.expression)
  );
}

function isBodySet(node, key, value) {
  if (!ts.isCallExpression(node)) return false;
  const expression = stripParentheses(node.expression);
  return (
    ts.isPropertyAccessExpression(expression) &&
    isIdentifier(expression.expression, "body") &&
    expression.name.text === "set" &&
    stringArgument(node, 0) === key &&
    stringArgument(node, 1) === value
  );
}

function officialTaxContract(createCheckoutBody) {
  if (!createCheckoutBody) return false;

  const requiredSets = [
    ["automatic_tax[enabled]", "true"],
    ["line_items[0][price_data][tax_behavior]", "exclusive"],
    [
      "line_items[0][price_data][product_data][tax_code]",
      "txcd_99999999",
    ],
    ["line_items[1][price_data][tax_behavior]", "exclusive"],
  ];
  const officialBlocks = descendants(
    createCheckoutBody,
    (node) =>
      ts.isIfStatement(node) &&
      isProductProperty(node.expression, "is_official") &&
      ts.isBlock(node.thenStatement),
  );
  const checkoutStatementIndex = createCheckoutBody.statements.findIndex(
    (statement) =>
      statementContainsCall(
        statement,
        new Set(["createStripeCheckoutSession"]),
      ),
  );

  if (checkoutStatementIndex < 0) return false;

  return requiredSets.every(([key, value]) => {
    const matchingSets = descendants(
      createCheckoutBody,
      (node) => ts.isCallExpression(node) && isBodySet(node, key, value),
    );
    const allSetsForKey = descendants(
      createCheckoutBody,
      (node) =>
        ts.isCallExpression(node) &&
        stringArgument(node, 0) === key,
    );
    const setStatementIndex = createCheckoutBody.statements.findIndex(
      (statement) =>
        descendants(
          statement,
          (node) => ts.isCallExpression(node) && isBodySet(node, key, value),
        ).length === 1,
    );

    return (
      matchingSets.length === 1 &&
      allSetsForKey.length === 1 &&
      setStatementIndex >= 0 &&
      setStatementIndex < checkoutStatementIndex &&
      officialBlocks.some((block) =>
        descendants(
          block.thenStatement,
          (node) => ts.isCallExpression(node) && isBodySet(node, key, value),
        ).length === 1,
      )
    );
  });
}

function shippingCountryContract(createCheckoutBody) {
  if (!createCheckoutBody) return false;

  const allShippingSets = descendants(
    createCheckoutBody,
    (node) =>
      ts.isCallExpression(node) &&
      stringArgument(node, 0)?.startsWith(
        "shipping_address_collection[allowed_countries]",
      ),
  );
  const shippingBlock = descendants(
    createCheckoutBody,
    (node) =>
      ts.isIfStatement(node) &&
      isProductProperty(node.expression, "shipping_required"),
  )[0];

  if (
    allShippingSets.length !== 2 ||
    !shippingBlock ||
    !ts.isBlock(shippingBlock.thenStatement)
  ) {
    return false;
  }

  const statements = shippingBlock.thenStatement.statements;
  const officialUs = statements.some((statement) =>
    directExpressionCall(statement, (call) => isShippingCountrySet(call, 0, "US")),
  );
  const marketplaceBlock = statements.find(
    (statement) =>
      ts.isIfStatement(statement) &&
      isNegationOf(statement.expression, (operand) =>
        isProductProperty(operand, "is_official"),
      ),
  );
  const marketplaceCa =
    marketplaceBlock && ts.isBlock(marketplaceBlock.thenStatement)
      ? marketplaceBlock.thenStatement.statements.some((statement) =>
          directExpressionCall(statement, (call) =>
            isShippingCountrySet(call, 1, "CA"),
          ),
        )
      : false;

  return officialUs && marketplaceCa;
}

function marketplaceGateContract(
  postBody,
  adminStatementIndex,
  firstCheckoutSideEffectIndex,
) {
  if (!postBody) return false;

  const statements = [...postBody.statements];
  const flowDeclarationIndex = statements.findIndex((statement) =>
    descendants(statement, (node) => {
      if (!ts.isVariableDeclaration(node) || !isIdentifier(node.name, "checkoutFlow")) {
        return false;
      }
      const initializer = node.initializer && stripParentheses(node.initializer);
      return (
        initializer &&
        ts.isConditionalExpression(initializer) &&
        isProductProperty(initializer.condition, "is_official") &&
        ts.isStringLiteral(initializer.whenTrue) &&
        initializer.whenTrue.text === "official_merch" &&
        ts.isStringLiteral(initializer.whenFalse) &&
        initializer.whenFalse.text === "marketplace_merch"
      );
    }).length > 0,
  );
  const checkoutGateIndex = statements.findIndex((statement) =>
    descendants(statement, (node) => {
      if (
        !ts.isVariableDeclaration(node) ||
        !isIdentifier(node.name, "checkoutCreationEnabled") ||
        !node.initializer ||
        !ts.isCallExpression(stripParentheses(node.initializer))
      ) {
        return false;
      }
      const call = stripParentheses(node.initializer);
      return (
        isIdentifier(call.expression, "stripeCheckoutCreationEnabled") &&
        call.arguments.length === 1 &&
        isIdentifier(call.arguments[0], "checkoutFlow")
      );
    }).length > 0,
  );
  const checkoutRejectIndex = statements.findIndex(
    (statement) =>
      ts.isIfStatement(statement) &&
      isNegationOf(statement.expression, (operand) =>
        isIdentifier(operand, "checkoutCreationEnabled"),
      ) &&
      hasGuaranteedReturn(statement.thenStatement),
  );
  const marketplaceBlockIndex = statements.findIndex(
    (statement) =>
      ts.isIfStatement(statement) &&
      isNegationOf(statement.expression, (operand) =>
        isProductProperty(operand, "is_official"),
      ) &&
      ts.isBlock(statement.thenStatement),
  );
  const marketplaceBlock = statements[marketplaceBlockIndex];
  const firstMarketplaceStatement = marketplaceBlock?.thenStatement.statements[0];
  const destinationGate =
    firstMarketplaceStatement &&
    ts.isIfStatement(firstMarketplaceStatement) &&
    isNegationOf(firstMarketplaceStatement.expression, (operand) => {
      const current = stripParentheses(operand);
      return (
        ts.isCallExpression(current) &&
        isIdentifier(current.expression, "stripeMerchDestinationChargesEnabled")
      );
    }) &&
    hasGuaranteedReturn(firstMarketplaceStatement.thenStatement);

  return (
    flowDeclarationIndex >= 0 &&
    checkoutGateIndex > flowDeclarationIndex &&
    checkoutRejectIndex > checkoutGateIndex &&
    checkoutRejectIndex < adminStatementIndex &&
    marketplaceBlockIndex > adminStatementIndex &&
    firstCheckoutSideEffectIndex > marketplaceBlockIndex &&
    Boolean(destinationGate)
  );
}

export function paymentPilotCandidatePolicyBlockers(merchCheckoutSource) {
  const sourceFile = ts.createSourceFile(
    "merch-checkout-route.ts",
    merchCheckoutSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  if (sourceFile.parseDiagnostics.length > 0) {
    return ["Candidate policy / Merch checkout source must parse as TypeScript"];
  }

  const blockers = [];
  const postBody = findFunctionBody(sourceFile, "POST");
  const createCheckoutBody = findFunctionBody(sourceFile, "createCheckoutSession");
  const postStatements = postBody ? [...postBody.statements] : [];
  const officialRejectIndex = postStatements.findIndex(
    (statement) =>
      ts.isIfStatement(statement) &&
      isOfficialNonShippingCondition(statement.expression) &&
      hasGuaranteedReturn(statement.thenStatement),
  );
  const adminStatementIndex = postStatements.findIndex((statement) =>
    statementContainsCall(statement, new Set(["createAdminClient"])),
  );
  const firstCheckoutSideEffectIndex = postStatements.findIndex((statement) =>
    statementContainsCall(
      statement,
      new Set(["createCheckoutSession", "insert", "rpc"]),
    ),
  );

  if (officialRejectIndex < 0) {
    blockers.push(
      "Candidate policy / Official non-shipping products must be rejected",
    );
  }
  if (
    officialRejectIndex < 0 ||
    adminStatementIndex < 0 ||
    firstCheckoutSideEffectIndex < 0 ||
    officialRejectIndex >= adminStatementIndex ||
    officialRejectIndex >= firstCheckoutSideEffectIndex
  ) {
    blockers.push(
      "Candidate policy / Official product rejection must precede admin client creation and checkout side effects",
    );
  }
  if (!shippingCountryContract(createCheckoutBody)) {
    blockers.push(
      "Candidate policy / Official physical shipping countries must be exactly US",
    );
    blockers.push(
      "Candidate policy / Marketplace physical shipping countries must remain exactly US and CA",
    );
  }
  if (!officialTaxContract(createCheckoutBody)) {
    blockers.push(
      "Candidate policy / Official physical checkout must retain automatic tangible-goods tax",
    );
  }
  if (
    !marketplaceGateContract(
      postBody,
      adminStatementIndex,
      firstCheckoutSideEffectIndex,
    )
  ) {
    blockers.push(
      "Candidate policy / Marketplace physical checkout must retain independent checkout and destination-charge gates",
    );
  }

  return blockers;
}
