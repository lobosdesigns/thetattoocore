import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const root = process.cwd();
const pgData = mkdtempSync(path.join(tmpdir(), "ttc-admin-idempotency-pg-"));
const sqlFile = path.join(
  root,
  "scripts",
  "test-admin-operation-idempotency-db.sql",
);
const port = await freePort();
let started = false;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

function pgEnv() {
  return {
    ...process.env,
    PGDATABASE: "postgres",
    PGHOST: "127.0.0.1",
    PGPORT: String(port),
    PGUSER: "postgres",
  };
}

function runBin(bin, args, options = {}) {
  return execFileSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    env: pgEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

try {
  runBin(
    "initdb",
    [
      "-D",
      pgData,
      "-U",
      "postgres",
      "--auth=trust",
      "--no-instructions",
    ],
    { stdio: "ignore" },
  );
  runBin(
    "pg_ctl",
    [
      "-D",
      pgData,
      "-o",
      `-p ${port} -h 127.0.0.1`,
      "-w",
      "start",
    ],
    { stdio: "ignore" },
  );
  started = true;

  const output = runBin("psql", [
    "-X",
    "-q",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    sqlFile,
  ]);

  if (!output.includes("PASS admin operation idempotency migration")) {
    throw new Error("The migration test did not report completion.");
  }

  console.log(
    `PASS admin operation idempotency database contracts on disposable PostgreSQL ${port}`,
  );
} finally {
  if (started) {
    try {
      runBin(
        "pg_ctl",
        ["-D", pgData, "-m", "fast", "-w", "stop"],
        { stdio: "ignore" },
      );
    } catch {
      // Best-effort cleanup for a disposable local cluster.
    }
  }

  rmSync(pgData, { force: true, recursive: true });
}
