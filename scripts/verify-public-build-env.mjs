import nextEnv from "@next/env";
import {
  publicBuildConfigError,
  publicBuildEnvIsValid,
} from "./lib/public-build-env.mjs";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

if (!publicBuildEnvIsValid(process.env)) {
  console.error(publicBuildConfigError);
  process.exit(1);
}

console.log("PASS public app build configuration is valid.");
