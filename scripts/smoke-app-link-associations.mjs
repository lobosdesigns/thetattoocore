const baseUrl = (process.env.SMOKE_BASE_URL || "https://thetattoocore.com").replace(/\/$/, "");
const expectedUnavailable = "Association file is not available for this build.";
const paths = [
  {
    kind: "android",
    path: "/.well-known/assetlinks.json",
  },
  {
    kind: "ios",
    path: "/.well-known/apple-app-site-association",
  },
];

function fail(label, message) {
  console.error(`FAIL ${label}`);
  console.error(`  ${message}`);
  process.exitCode = 1;
}

function pass(label, mode) {
  console.log(`PASS ${label} (${mode})`);
}

function validateAndroidPayload(payload) {
  return (
    Array.isArray(payload) &&
    payload.some(
      (entry) =>
        Array.isArray(entry.relation) &&
        entry.relation.includes("delegate_permission/common.handle_all_urls") &&
        entry.target?.namespace === "android_app" &&
        entry.target?.package_name === "com.thetattoocore.app" &&
        Array.isArray(entry.target?.sha256_cert_fingerprints) &&
        entry.target.sha256_cert_fingerprints.every((fingerprint) =>
          /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(fingerprint),
        ),
    )
  );
}

function validateIosPayload(payload) {
  return (
    payload?.applinks &&
    Array.isArray(payload.applinks.apps) &&
    Array.isArray(payload.applinks.details) &&
    payload.applinks.details.some(
      (detail) =>
        /^[A-Z0-9]{10}\.com\.thetattoocore\.app$/i.test(detail.appID) &&
        Array.isArray(detail.paths) &&
        detail.paths.includes("/u/*") &&
        detail.paths.includes("/p/*") &&
        detail.paths.includes("/messages*"),
    )
  );
}

async function checkAssociation({ kind, path }) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      "user-agent": "TheTattooCoreAppLinkSmoke/1.0",
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  const label = path;

  if (response.status === 404) {
    if (text.includes(expectedUnavailable)) {
      pass(label, "fail-closed until private identifiers are configured");
      return;
    }

    fail(label, `expected fail-closed body, got ${JSON.stringify(text.slice(0, 120))}`);
    return;
  }

  if (response.status !== 200) {
    fail(label, `unexpected status ${response.status}`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    fail(label, `invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const valid = kind === "android" ? validateAndroidPayload(payload) : validateIosPayload(payload);

  if (valid) {
    pass(label, "association JSON valid");
    return;
  }

  fail(label, "association JSON is missing required app-link fields");
}

await Promise.all(paths.map(checkAssociation));

if (process.exitCode) {
  process.exit(process.exitCode);
}
