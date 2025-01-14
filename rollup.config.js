const commonjs = require("@rollup/plugin-commonjs");
const terser = require("@rollup/plugin-terser");

const plugins = [commonjs(), terser()];

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
      footer: "export const { phonemize } = phonemizerExports;", // add the export statement
    },
    plugins,
  },
  // Export the web version of the library
  {
    input: "src/phonemizer.js", // CommonJS entry file
    output: {
      file: "dist/phonemizer.web.js",
      format: "esm",
      footer: "export const { phonemize } = phonemizerExports;", // add the export statement
    },
    plugins,
  },
];
