// Runs the PaperCrumple fold simulation off the main thread.
import { createPaperPath, createCrinkleNormals } from './paperPath.js';

self.onmessage = ({ data }) => {
  const { id, rest, triangles, shortSide, density, sharpness, depth, seed } = data;
  try {
    const { samples, creased } = createPaperPath(rest, triangles, shortSide, density, sharpness, depth, seed);
    // samples[0] may be a plain array copy of rest; send everything as Float32Arrays.
    const out = samples.map(s => (s instanceof Float32Array ? s : Float32Array.from(s)));
    const crinkle = createCrinkleNormals(256, seed);
    self.postMessage({ id, samples: out, creased, crinkle }, [...out.map(s => s.buffer), creased.buffer, crinkle.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
};
