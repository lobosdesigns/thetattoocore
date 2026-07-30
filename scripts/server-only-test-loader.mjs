const emptyServerOnlyModule =
  "data:text/javascript,export%20default%20undefined%3B";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      format: "module",
      shortCircuit: true,
      url: emptyServerOnlyModule,
    };
  }

  return nextResolve(specifier, context);
}
