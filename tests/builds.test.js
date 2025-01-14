import { describe, expect, test } from "vitest";

import { spawnSync } from "child_process";

const MODULE_NAME = "phonemizer";
const IMPORTS = `{ phonemize }`;
const CODE_BODY = `
const phonemes = await phonemize("Hello world.");
process.stdout.write(phonemes.join(''));
`;

const TARGET_OUTPUT = "həlˈoʊ wˈɜːld";

const wrap_async_iife = (code) => `(async function() { ${code} })();`;

const check = (code, module = false) => {
  const args = ["-e", code];
  if (module) args.push("--input-type=module");
  const { status, stdout, stderr } = spawnSync("node", args);
  expect(stderr.toString()).toEqual(""); // No warnings or errors are printed
  expect(stdout.toString()).toEqual(TARGET_OUTPUT); // The output should match
  expect(status).toEqual(0); // The process should exit cleanly
};

describe("Testing the bundle", () => {
  test("ECMAScript Module (ESM)", () => {
    check(`import ${IMPORTS} from "${MODULE_NAME}";${CODE_BODY}`, true);
  });

  test("CommonJS (CJS) with require", () => {
    check(
      `const ${IMPORTS} = require("${MODULE_NAME}");${wrap_async_iife(CODE_BODY)}`,
    );
  });

  test("CommonJS (CJS) with dynamic import", () => {
    check(
      `${wrap_async_iife(`const ${IMPORTS} = await import("${MODULE_NAME}");${CODE_BODY}`)}`,
    );
  });
});
