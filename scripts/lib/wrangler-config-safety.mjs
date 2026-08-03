export function parseJsoncStructure(source) {
  let index = 0;

  function fail(message) {
    throw new Error(`${message} at character ${index}`);
  }

  function skipTrivia() {
    while (index < source.length) {
      if (/\s/.test(source[index])) {
        index += 1;
      } else if (source.startsWith("//", index)) {
        const lineEnd = source.indexOf("\n", index + 2);
        index = lineEnd === -1 ? source.length : lineEnd + 1;
      } else if (source.startsWith("/*", index)) {
        const commentEnd = source.indexOf("*/", index + 2);
        if (commentEnd === -1) fail("Unterminated JSONC comment");
        index = commentEnd + 2;
      } else {
        break;
      }
    }
  }

  function parseString() {
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source.charCodeAt(index) === 92) {
        index += 2;
      } else if (source[index] === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index));
      } else {
        index += 1;
      }
    }
    fail("Unterminated JSONC string");
  }

  function parseArray() {
    const items = [];
    index += 1;
    skipTrivia();
    while (source[index] !== "]") {
      items.push(parseValue());
      skipTrivia();
      if (source[index] === "]") break;
      if (source[index] !== ",") fail("Expected a comma in JSONC array");
      index += 1;
      skipTrivia();
      if (source[index] === "]") break;
    }
    if (source[index] !== "]") fail("Unterminated JSONC array");
    index += 1;
    return { items, type: "array" };
  }

  function parseObject() {
    const entries = [];
    index += 1;
    skipTrivia();
    while (source[index] !== "}") {
      if (source[index] !== '"') fail("Expected a JSONC object key");
      const key = parseString();
      skipTrivia();
      if (source[index] !== ":") fail("Expected a colon after JSONC object key");
      index += 1;
      entries.push({ key, value: parseValue() });
      skipTrivia();
      if (source[index] === "}") break;
      if (source[index] !== ",") fail("Expected a comma in JSONC object");
      index += 1;
      skipTrivia();
      if (source[index] === "}") break;
    }
    if (source[index] !== "}") fail("Unterminated JSONC object");
    index += 1;
    return { entries, type: "object" };
  }

  function parseValue() {
    skipTrivia();
    if (source[index] === "{") return parseObject();
    if (source[index] === "[") return parseArray();
    if (source[index] === '"') {
      return { type: "scalar", value: parseString() };
    }
    const start = index;
    while (index < source.length && !/[\s,}\]]/.test(source[index])) {
      index += 1;
    }
    if (start === index) fail("Expected a JSONC value");
    return {
      type: "scalar",
      value: JSON.parse(source.slice(start, index)),
    };
  }

  const root = parseValue();
  skipTrivia();
  if (index !== source.length) fail("Unexpected JSONC content");
  return root;
}

export function requiredFalseStringBindingsSafety(source, requiredKeys) {
  const issues = [];
  let root;
  try {
    root = parseJsoncStructure(source);
  } catch (error) {
    return {
      issues: [
        `wrangler JSONC parse failed: ${error instanceof Error ? error.message : "unknown error"}`,
      ],
      ok: false,
    };
  }
  if (root.type !== "object") {
    return { issues: ["wrangler root must be an object"], ok: false };
  }
  const varsEntries = root.entries.filter(({ key }) => key === "vars");
  if (varsEntries.length !== 1 || varsEntries[0].value.type !== "object") {
    return { issues: ["wrangler vars must be one object"], ok: false };
  }
  const vars = varsEntries[0].value.entries;
  for (const key of requiredKeys) {
    const values = vars
      .filter((entry) => entry.key === key)
      .map((entry) => entry.value);
    if (
      values.length !== 1 ||
      values[0].type !== "scalar" ||
      values[0].value !== "false"
    ) {
      issues.push(`${key} must appear exactly once with string value false`);
    }
  }
  return { issues, ok: issues.length === 0 };
}
