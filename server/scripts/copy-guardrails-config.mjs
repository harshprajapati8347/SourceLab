import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist/config", { recursive: true });
copyFileSync(
  "src/config/guardrails_config.json",
  "dist/config/guardrails_config.json",
);
