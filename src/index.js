import 'react-native-webassembly'
import { initialize, getInstance } from './phonemizer.js'

async function testInitialization() {
  console.log('Attempting to initialize Phonemizer WASM...')
  try {
    await initialize()
    console.log('Initialization successful!')

    const wasmInstance = getInstance()
    if (wasmInstance && wasmInstance.exports) {
      console.log('WASM Exports:', Object.keys(wasmInstance.exports))
    } else {
      console.warn('WASM instance or exports not available after initialization.')
    }

  } catch (error) {
    console.error('Initialization failed in test script:', error)
  }
}

testInitialization()

// Export the phonemizer functions for actual use
export { initialize, phoneme, getInstance } from './phonemizer.js' 