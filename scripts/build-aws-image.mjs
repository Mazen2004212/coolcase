import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const REQUIRED_BUILD_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const OPTIONAL_BUILD_VARIABLES = [
  "SERVER_ACTION_ALLOWED_ORIGINS",
  "COOLCASE_BUILD_ID",
];

const BUILD_VARIABLES = [
  ...REQUIRED_BUILD_VARIABLES,
  ...OPTIONAL_BUILD_VARIABLES,
];

const imageTag = process.argv[2] || "coolcase:aws";
const appUrlOverride = process.argv[3];
const envFile =
  process.env.COOLCASE_DOCKER_ENV_FILE || ".env.local";

function parseEnvFile(contents) {
  const values = new Map();

  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u,
    );

    if (!match) continue;

    let value = match[2];

    if (
      value.length >= 2 &&
      (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
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
  fileValues = parseEnvFile(
    readFileSync(envFile, "utf8"),
  );
} catch (error) {
  console.error(
    `Unable to read ${envFile}: ${error.message}`,
  );
  process.exit(1);
}

const buildValues = new Map(
  BUILD_VARIABLES.map((name) => [
    name,
    name === "NEXT_PUBLIC_APP_URL" && appUrlOverride
      ? appUrlOverride
      : process.env[name] ||
        fileValues.get(name) ||
        "",
  ]),
);

const missing = REQUIRED_BUILD_VARIABLES.filter(
  (name) => !buildValues.get(name),
);

if (missing.length > 0) {
  console.error(
    `Missing required Docker build values: ${missing.join(", ")}`,
  );
  process.exit(1);
}

const dockerArguments = [
  "buildx",
  "build",

  "--platform",
  "linux/amd64",

  "--provenance=false",
  "--sbom=false",
];

for (const name of BUILD_VARIABLES) {
  const value = buildValues.get(name);

  if (
    !value &&
    OPTIONAL_BUILD_VARIABLES.includes(name)
  ) {
    continue;
  }

  dockerArguments.push(
    "--build-arg",
    `${name}=${value}`,
  );
}

dockerArguments.push(
  "-f",
  "Dockerfile.aws",

  "-t",
  imageTag,

  "--output",
  "type=docker,compression=gzip,compression-level=6,force-compression=true",

  ".",
);

const suppliedBuildVariables = BUILD_VARIABLES.filter(
  (name) => buildValues.get(name),
);

console.log(
  `Building ${imageTag} with allowlisted build values: ${suppliedBuildVariables.join(", ")}`,
);

const result = spawnSync(
  "docker",
  dockerArguments,
  {
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(
    `Unable to start Docker: ${result.error.message}`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);