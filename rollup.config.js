const commonjs = require("@rollup/plugin-commonjs");
const replace = require("@rollup/plugin-replace");
const copy = require("rollup-plugin-copy");
const terser = require("@rollup/plugin-terser");

module.exports = [
  // Export CommonJS and ES module versions of the library
  {
    input: "src/phonemizer.js",
    output: {
      file: "dist/phonemizer.js",
      format: "cjs",
    },
    external: ["fs", "path", "crypto"],
    plugins: [
      commonjs(),
      terser(),
      copy({
        targets: [{ src: "src/espeakng.worker.data", dest: "dist" }],
      }),
    ],
  },
  {
    input: "src/phonemizer.js",
    output: {
      file: "dist/phonemizer.mjs",
      format: "esm",
      footer: "export const { phonemize } = phonemizerExports;", // add the export statement
    },
    external: ["fs", "path", "crypto"],
    plugins: [
      commonjs(),
      replace({
        include: "src/espeakng.worker.js",
        delimiters: ["", ""],
        preventAssignment: true,
        values: {
          __dirname: "import.meta.dirname",
        },
      }),
      terser(),
      copy({
        targets: [{ src: "src/espeakng.worker.data", dest: "dist" }],
      }),
    ],
  },
  // Export the web version of the library
  {
    input: "src/phonemizer.js", // CommonJS entry file
    output: {
      file: "dist/phonemizer.web.js",
      format: "esm",
      footer: "export const { phonemize } = phonemizerExports;", // add the export statement
    },
    plugins: [
      replace({
        include: "src/espeakng.worker.js",
        delimiters: ["", ""],
        preventAssignment: true,
        values: {
          // Replace require() calls with empty objects (these paths won't be used in the browser)
          'require("fs")': "({})",
          'require("path")': "({})",
          'require("crypto")': "({})",
        },
      }),
      commonjs(),
      terser(),
      copy({
        targets: [{ src: "src/espeakng.worker.data", dest: "dist" }],
      }),
    ],
  },
];
