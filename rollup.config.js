const commonjs = require("@rollup/plugin-commonjs");
const terser = require("@rollup/plugin-terser");

const plugins = [commonjs(), terser()];

const ESM_FOOTER = "export const { phonemize, list_voices } = phonemizerExports;"; // add the export statement

module.exports = [
  // Export CommonJS and ES module versions of the library
  {
    input: "src/phonemizer.js",
    output: {
      file: "dist/phonemizer.js",
      format: "cjs",
    },
    plugins,
  },
  {
    input: "src/phonemizer.js",
    output: {
      file: "dist/phonemizer.mjs",
      format: "esm",
      footer: ESM_FOOTER,
    },
    plugins,
  },
  // Export the web version of the library
  {
    input: "src/phonemizer.js", // CommonJS entry file
    output: {
      file: "dist/phonemizer.web.js",
      format: "esm",
      footer: ESM_FOOTER,
    },
    plugins,
  },
];
