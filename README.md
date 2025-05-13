# react-native-phonemizer

**A React Native adaptation of Phonemizer.js for text-to-phoneme conversion using eSpeak NG.**

This package allows you to convert text into phonemes directly within your React Native application. It leverages WebAssembly and requires the `react-native-webassembly` package.

**Important for Expo Users:** This package includes native code dependencies through `react-native-webassembly`. If you are using the Expo managed workflow, you will need to generate a custom development client using `npx expo prebuild --clean` and then run your app with `npx expo run:ios` or `npx expo run:android`. It will not work with the standard Expo Go app.

## Installation

1.  **Install the package:**
    ```bash
    npm install react-native-phonemizer
    # or
    yarn add react-native-phonemizer
    ```
    If using Expo:
    ```bash
    npx expo install react-native-phonemizer
    ```

2.  **Install peer dependencies:**
    This package relies on `react-native-webassembly`. Ensure it and other core React Native libraries are installed.
    ```bash
    npm install react-native-webassembly base-64 pako
    # or
    yarn add react-native-webassembly base-64 pako
    ```
    If using Expo, these should ideally be installed via `npx expo install`:
    ```bash
    npx expo install react-native-webassembly base-64 pako
    ```

3.  **Configure `app.json` (for Expo projects):**
    Add `react-native-webassembly` to your `app.json` plugins:
    ```json
    {
      "expo": {
        // ... other configurations
        "plugins": [
          "react-native-webassembly"
          // ... other plugins
        ]
      }
    }
    ```

4.  **Prebuild (for Expo managed workflow):**
    Generate the native `ios` and `android` directories.
    ```bash
    npx expo prebuild --clean
    ```
    Then run your app using `npx expo run:ios` or `npx expo run:android`.

## Basic Usage

```javascript
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { initialize, phonemize, getInstance } from 'react-native-phonemizer';

export default function App() {
  const [phonemes, setPhonemes] = useState(null);
  const [error, setError] = useState(null);
  const [wasmExports, setWasmExports] = useState(null);

  useEffect(() => {
    async function initAndPhonemize() {
      try {
        console.log('Attempting to initialize phonemizer...');
        await initialize();
        console.log('Phonemizer initialized successfully!');

        const instance = getInstance();
        if (instance?.exports) {
          console.log('WASM Exports:', Object.keys(instance.exports));
          setWasmExports(Object.keys(instance.exports).join(', '));
        }

        console.log('Attempting to phonemize "Hello world."...');
        const result = await phonemize("Hello world.");
        console.log('Phonemes:', result);
        setPhonemes(result.join(' ')); // Example: display as a string
      } catch (e) {
        console.error('Failed to initialize or phonemize:', e);
        setError(e.message);
      }
    }

    initAndPhonemize();
  }, []);

  if (error) {
    return <View><Text>Error: {error}</Text></View>;
  }

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>Phonemizer Test</Text>
      {wasmExports && <Text>WASM Exports: {wasmExports}</Text>}
      {phonemes ? <Text>Phonemes for "Hello world.": {phonemes}</Text> : <Text>Loading...</Text>}
    </View>
  );
}
```

## Advanced Usage

The original `phonemizer.js` package had advanced features like listing voices and selecting different languages/voices. These functionalities depend on the specific WebAssembly module's exported functions.

Once the WASM module is initialized, you can inspect `getInstance().exports` to see available functions. The `phonemize` function in this package is a basic wrapper. To use more advanced eSpeak NG features, you would need to:

1.  Identify the corresponding exported C functions from the eSpeak NG WASM build.
2.  Write JavaScript wrappers (similar to the `phoneme` function in `src/phonemizer.js`) to handle string marshalling (writing JS strings to WASM memory and reading results back).

For example, if a function like `espeak_ListVoices` or `espeak_SetVoiceByName` were exported by the WASM module, you could call them.

The original `list_voices` example would need to be adapted to call the relevant exported WASM functions for listing voices and then process their output. This typically involves direct interaction with WASM memory and is beyond the scope of the current basic wrapper.