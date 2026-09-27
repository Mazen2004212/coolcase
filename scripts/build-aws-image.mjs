import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PUBLIC_BUILD_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const imageTag = process.argv[2] || "coolcase:aws";
const appUrlOverride = process.argv[3];
const envFile = process.env.COOLCASE_DOCKER_ENV_FILE || ".env.local";

function parseEnvFile(contents) {
  const values = new Map();

  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);

    if (!match) continue;

    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, "").trim();
    }

    values.set(match[1], value);
  }

  return values;
}

let fileValues;
try {
  fileValues = parseEnvFile(readFileSync(envFile, "utf8"));
} catch (error) {
  console.error(`Unable to read ${envFile}: ${error.message}`);
  process.exit(1);
}

const buildValues = new Map(
  PUBLIC_BUILD_VARIABLES.map((name) => [
    name,
    name === "NEXT_PUBLIC_APP_URL" && appUrlOverride
      ? appUrlOverride
      : process.env[name] || fileValues.get(name) || "",
  ]),
);
const missing = PUBLIC_BUILD_VARIABLES.filter((name) => !buildValues.get(name));

if (missing.length > 0) {
  console.error(`Missing required public Docker build values: ${missing.join(", ")}`);
  process.exit(1);
}

const dockerArguments = ["build"];
for (const name of PUBLIC_BUILD_VARIABLES) {
  dockerArguments.push("--build-arg", `${name}=${buildValues.get(name)}`);
}
dockerArguments.push("-f", "Dockerfile.aws", "-t", imageTag, ".");

console.log(
  `Building ${imageTag} with allowlisted public values: ${PUBLIC_BUILD_VARIABLES.join(", ")}`,
);
const result = spawnSync("docker", dockerArguments, {
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to start Docker: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
