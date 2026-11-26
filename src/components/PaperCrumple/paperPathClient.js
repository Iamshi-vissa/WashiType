// Hands the PaperCrumple fold simulation to a Web Worker and caches the result by its
// settings, so the second sheet with the same size and fold settings opens instantly.
import { createPaperPath } from './paperPath.js';

const cache = new Map();
let worker = null;
let nextId = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./paperPath.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve({ samples: data.samples, creased: data.creased });
    };
    worker.onerror = event => {
      // A broken worker shouldn't break the sheet: fall back to the main thread.
      event.preventDefault?.();
      worker = false;
      for (const [id, job] of pending) {
        pending.delete(id);
        job.fallback();
      }
    };
  } catch {
    worker = false;
  }
  return worker;
}

export function requestPaperPath(key, rest, triangles, shortSide, density, sharpness, depth, seed) {
  if (cache.has(key)) return cache.get(key);
  const runHere = () => createPaperPath(rest, triangles, shortSide, density, sharpness, depth, seed);
  const job = new Promise((resolve, reject) => {
    const w = getWorker();
    if (!w) {
      // No worker support: still don't block the frame that opened the sheet.
      setTimeout(() => {
        try {
          resolve(runHere());
        } catch (error) {
          reject(error);
        }
      }, 0);
      return;
    }
    const id = ++nextId;
    pending.set(id, {
      resolve,
      reject,
      fallback: () => {
        try {
          resolve(runHere());
        } catch (error) {
          reject(error);
        }
      }
    });
    w.postMessage({ id, rest: Float64Array.from(rest), triangles: Uint32Array.from(triangles), shortSide, density, sharpness, depth, seed });
  });
  // Don't cache failures.
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
