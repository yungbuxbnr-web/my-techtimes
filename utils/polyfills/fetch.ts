// @ts-expect-error - no type declarations for this internal module
import { polyfillGlobal } from 'react-native/Libraries/Utilities/PolyfillFunctions';

// NOTE: We intentionally do NOT polyfill global fetch with expo/fetch.
// expo/fetch causes Better Auth's client to return a Kotlin-incompatible
// type on Android, crashing the JS bridge. The default Hermes fetch is used instead.

// Dynamic imports so missing packages don't break the bundle
Promise.all([
  // eslint-disable-next-line import/no-unresolved
  import('@stardazed/streams-text-encoding').catch(() => null),
  import('@ungap/structured-clone').catch(() => null),
]).then(([streamsModule, structuredCloneModule]) => {
  if (streamsModule) {
    polyfillGlobal('TextEncoderStream', () => streamsModule.TextEncoderStream);
    polyfillGlobal('TextDecoderStream', () => streamsModule.TextDecoderStream);
  }

  if (structuredCloneModule && !('structuredClone' in globalThis)) {
    polyfillGlobal('structuredClone', () => structuredCloneModule.default);
  }
});
