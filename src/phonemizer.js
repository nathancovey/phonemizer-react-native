const Module = require("./espeakng.worker.js");

const workerPromise = new Promise((resolve) => {
  if (Module.calledRun) {
    resolve(new Module.eSpeakNGWorker());
  } else {
    Module.onRuntimeInitialized = () => resolve(new Module.eSpeakNGWorker());
  }
});

/**
 * Multilingual text to phonemes converter
 *
 * @param {string} text The input text
 * @returns {Promise<string[]>} A phonemized version of the input
 */
const phonemize = (text) =>
  workerPromise.then(
    (w) =>
      w
        .synthesize_ipa(text)
        .ipa?.split("\n")
        .filter((x) => x.length > 0) ?? [],
  );

exports.phonemize = phonemize;
