import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

const plugins = [commonjs(), terser()];

const OUTPUT_CONFIGS = [
  {
    file: "./dist/react-native-phonemizer.cjs",
    format: "cjs",
  },
  {
    file: "./dist/react-native-phonemizer.js",
    format: "esm",
  },
];

export default OUTPUT_CONFIGS.map((output) => ({
  input: "./src/index.js",
  output,
  plugins,
}));
