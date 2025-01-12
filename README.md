# Phonemizer.js

Simple text to phones converter using eSpeak NG.

## Example usage

### ES Modules

```js
import { phonemize } from "phonemizer";

const phonemes = await phonemize("Hello world.");
console.log(phonemes); // ['həlˈəʊ wˈɜːld']
```

### CommonJS

```js
const { phonemize } = require("phonemizer");

(async () => {
  const phonemes = await phonemize("Hello world.");
  console.log(phonemes); // ['həlˈəʊ wˈɜːld']
})();
```
