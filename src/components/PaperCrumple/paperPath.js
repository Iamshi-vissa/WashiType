// Washi Type: the paper simulation from PaperCrumple, moved into its own module so it
// can run in a Web Worker instead of freezing the page for half a second.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function randomSource(seed) {
  let value = seed | 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function createPaperPath(
  rest,
  triangles,
  shortSide,
  density,
  sharpness,
  depth,
  seed,
) {
  const count = rest.length / 3;
  const points = Float64Array.from(rest);
  const previous = Float64Array.from(rest);
  const before = Float64Array.from(rest);
  const edges = [];
  const hinges = [];
  const adjacency = new Map();
  const random = randomSource(seed);
  const guides = Array.from({ length: density }, () => {
    const angle = random() * Math.PI * 2;
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
      phase: random() * Math.PI * 2,
      weight: random() * 0.6 + 0.4,
    };
  });
  for (let t = 0; t < triangles.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = triangles[t + k],
        b = triangles[t + ((k + 1) % 3)],
        opposite = triangles[t + ((k + 2) % 3)];
      const key = Math.min(a, b) * count + Math.max(a, b);
      const other = adjacency.get(key);
      if (!other) {
        adjacency.set(key, { a, b, opposite });
        const length = Math.hypot(
          rest[a * 3] - rest[b * 3],
          rest[a * 3 + 1] - rest[b * 3 + 1],
        );
        edges.push(a * 3, b * 3, length);
      } else {
        const c = other.opposite * 3,
          d = opposite * 3;
        const length = Math.hypot(rest[c] - rest[d], rest[c + 1] - rest[d + 1]);
        const mx = (rest[c] + rest[d]) * 0.5,
          my = (rest[c + 1] + rest[d + 1]) * 0.5;
        let weakness = 0;
        for (const guide of guides) {
          const distance = Math.abs(
            Math.sin(
              ((mx * guide.x + my * guide.y) / shortSide) * 4 + guide.phase,
            ),
          );
          weakness = Math.max(
            weakness,
            Math.exp(-distance * distance * 80) * guide.weight,
          );
        }
        hinges.push(c, d, length, 0.12 + (1 - weakness) * 0.75);
      }
    }
  }
  const spacing = Math.sqrt((shortSide * shortSide) / count);
  const thickness = shortSide * 0.008;
  const samples = [rest.slice()];
  const frameCount = 64;
  const stepsPerFrame = 3;
  const totalSteps = frameCount * stepsPerFrame;
  let initialRadius = 0;
  for (let i = 0; i < rest.length; i += 3)
    initialRadius = Math.max(
      initialRadius,
      Math.hypot(rest[i] / 0.94, rest[i + 1] / 1.02),
    );
  initialRadius *= 1.02;
  function constrain(list, stride, stiffness, reverse) {
    for (let n = 0; n < list.length; n += stride) {
      const edge = reverse ? list.length - stride - n : n;
      const a = list[edge],
        b = list[edge + 1];
      const dx = points[b] - points[a],
        dy = points[b + 1] - points[a + 1],
        dz = points[b + 2] - points[a + 2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length < 0.000001) continue;
      const weight = stride === 4 ? list[edge + 3] : 1;
      const amount = (1 - list[edge + 2] / length) * 0.5 * stiffness * weight;
      points[a] += dx * amount;
      points[b] -= dx * amount;
      points[a + 1] += dy * amount;
      points[b + 1] -= dy * amount;
      points[a + 2] += dz * amount;
      points[b + 2] -= dz * amount;
    }
  }
  // Washi Type: the collision step used to test every point against every triangle
  // (quadratic, 3.8 s at 2,480 triangles). Points are now binned into a 3D grid of cells
  // about one triangle wide, and each triangle only tests the points in the cells its
  // bounding box touches.
  const cellSize = spacing * 1.25;
  const cellKey = (ix, iy, iz) =>
    ((ix + 512) * 1024 + (iy + 512)) * 1024 + (iz + 512);
  const bins = new Map();
  function binPoints() {
    for (const list of bins.values()) list.length = 0;
    for (let p = 0; p < points.length; p += 3) {
      const key = cellKey(
        Math.floor(points[p] / cellSize),
        Math.floor(points[p + 1] / cellSize),
        Math.floor(points[p + 2] / cellSize),
      );
      let list = bins.get(key);
      if (!list) bins.set(key, (list = []));
      list.push(p);
    }
  }
  function separateLayers() {
    const margin = thickness * 2;
    binPoints();
    for (let t = 0; t < triangles.length; t += 3) {
      const a = triangles[t] * 3,
        b = triangles[t + 1] * 3,
        c = triangles[t + 2] * 3;
      const ax = points[a],
        ay = points[a + 1],
        az = points[a + 2];
      const bx = points[b] - ax,
        by = points[b + 1] - ay,
        bz = points[b + 2] - az;
      const cx = points[c] - ax,
        cy = points[c + 1] - ay,
        cz = points[c + 2] - az;
      let nx = by * cz - bz * cy,
        ny = bz * cx - bx * cz,
        nz = bx * cy - by * cx;
      const length = Math.hypot(nx, ny, nz);
      if (length < 0.0000001) continue;
      nx /= length;
      ny /= length;
      nz /= length;
      const minX = Math.min(ax, points[b], points[c]) - margin;
      const maxX = Math.max(ax, points[b], points[c]) + margin;
      const minY = Math.min(ay, points[b + 1], points[c + 1]) - margin;
      const maxY = Math.max(ay, points[b + 1], points[c + 1]) + margin;
      const minZ = Math.min(az, points[b + 2], points[c + 2]) - margin;
      const maxZ = Math.max(az, points[b + 2], points[c + 2]) + margin;
      const bb = bx * bx + by * by + bz * bz,
        cc = cx * cx + cy * cy + cz * cz;
      const bc = bx * cx + by * cy + bz * cz;
      const determinant = bb * cc - bc * bc;
      if (determinant < 0.0000000001) continue;
      const ix0 = Math.floor(minX / cellSize),
        ix1 = Math.floor(maxX / cellSize);
      const iy0 = Math.floor(minY / cellSize),
        iy1 = Math.floor(maxY / cellSize);
      const iz0 = Math.floor(minZ / cellSize),
        iz1 = Math.floor(maxZ / cellSize);
      for (let ix = ix0; ix <= ix1; ix++)
        for (let iy = iy0; iy <= iy1; iy++)
          for (let iz = iz0; iz <= iz1; iz++) {
            const cell = bins.get(cellKey(ix, iy, iz));
            if (!cell) continue;
            for (const p of cell) {
              if (p === a || p === b || p === c) continue;
              if (
                points[p] < minX ||
                points[p] > maxX ||
                points[p + 1] < minY ||
                points[p + 1] > maxY ||
                points[p + 2] < minZ ||
                points[p + 2] > maxZ
              )
                continue;
              const rx = rest[p] - (rest[a] + rest[b] + rest[c]) / 3;
              const ry =
                rest[p + 1] - (rest[a + 1] + rest[b + 1] + rest[c + 1]) / 3;
              if (rx * rx + ry * ry < spacing * spacing * 6) continue;
              const dx = points[p] - ax,
                dy = points[p + 1] - ay,
                dz = points[p + 2] - az;
              const distance = dx * nx + dy * ny + dz * nz;
              const previousDistance =
                (before[p] - before[a]) * nx +
                (before[p + 1] - before[a + 1]) * ny +
                (before[p + 2] - before[a + 2]) * nz;
              const side = previousDistance >= 0 ? 1 : -1;
              if (distance * side >= thickness || Math.abs(distance) > margin)
                continue;
              const pb = dx * bx + dy * by + dz * bz,
                pc = dx * cx + dy * cy + dz * cz;
              const u = (cc * pb - bc * pc) / determinant;
              const v = (bb * pc - bc * pb) / determinant;
              if (u < 0 || v < 0 || u + v > 1) continue;
              const w = 1 - u - v;
              const correction =
                (thickness * side - distance) / (1 + w * w + u * u + v * v);
              for (let axis = 0; axis < 3; axis++) {
                const normal = axis === 0 ? nx : axis === 1 ? ny : nz;
                const movement = normal * correction;
                points[p + axis] += movement;
                points[a + axis] -= movement * w;
                points[b + axis] -= movement * u;
                points[c + axis] -= movement * v;
              }
            }
          }
    }
  }
  for (let step = 1; step <= totalSteps; step++) {
    const progress = step / totalSteps;
    const compression = progress * progress * (3 - 2 * progress);
    const radius =
      initialRadius * (1 - compression) +
      shortSide * (0.19 - depth * 0.025) * compression;
    before.set(points);
    for (let i = 0; i < points.length; i += 3) {
      const x = rest[i] / shortSide,
        y = rest[i + 1] / shortSide;
      let buckle = 0;
      for (const guide of guides)
        buckle +=
          Math.sin((x * guide.x + y * guide.y) * 5 + guide.phase) *
          guide.weight;
      for (let axis = 0; axis < 3; axis++) {
        const velocity = (points[i + axis] - previous[i + axis]) * 0.55;
        previous[i + axis] = points[i + axis];
        points[i + axis] += clamp(velocity, -spacing * 0.15, spacing * 0.15);
      }
      points[i + 2] +=
        (buckle / density) * shortSide * 0.0007 * Math.sin(progress * Math.PI);
    }
    for (let pass = 0; pass < 18; pass++) {
      constrain(hinges, 4, 0.45 * (1 - sharpness * 0.4), pass % 2 === 0);
      for (let i = 0; i < points.length; i += 3) {
        const x = points[i] / 0.94,
          y = points[i + 1] / 1.02,
          z = points[i + 2] / 0.86;
        const distance = Math.hypot(x, y, z);
        if (distance > radius) {
          const push = (1 - radius / distance) * 0.55;
          points[i] -= points[i] * push;
          points[i + 1] -= points[i + 1] * push;
          points[i + 2] -= points[i + 2] * push;
        }
      }
      constrain(edges, 3, 1, pass % 2 !== 0);
      if (pass === 8 || pass === 17) separateLayers();
    }
    for (let h = 0; h < hinges.length; h += 4) {
      const a = hinges[h],
        b = hinges[h + 1];
      const length = Math.hypot(
        points[a] - points[b],
        points[a + 1] - points[b + 1],
        points[a + 2] - points[b + 2],
      );
      if (length < hinges[h + 2] * 0.86)
        hinges[h + 2] += (length - hinges[h + 2]) * 0.12;
    }
    if (step % stepsPerFrame === 0) samples.push(Float32Array.from(points));
  }
  const folded = Float64Array.from(points);
  for (let step = 1; step <= 80; step++) {
    const t = step / 80;
    const unfold = t * t * (3 - 2 * t);
    for (let pass = 0; pass < 12; pass++) {
      for (let i = 0; i < points.length; i++) {
        const target = folded[i] + (rest[i] - folded[i]) * unfold;
        points[i] += (target - points[i]) * (i % 3 === 2 ? 0.04 : 0.22);
      }
      constrain(hinges, 4, 0.7, pass % 2 === 0);
      constrain(edges, 3, 1, pass % 2 !== 0);
    }
  }
  const creased = Float32Array.from(points);
  return { samples, creased };
}

// Washi Type: the sheet's mesh, moved out of the component so it can be built without
// three.js (to compute the fold path ahead of time). Same maths and random sequence as before;
// detail now goes up to 160 (resolution 40) instead of 96.
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);
export function buildSheetGrid({ paperWidth, paperHeight, detail, seed, foldCount, foldSharpness, wrinkleDepth }) {
  const aspect = paperHeight / paperWidth;
  const shortSide = Math.min(1, aspect);
  const resolution = Math.round(clamp(finite(detail, 64) / 4, 8, 40));
  const columns = Math.max(8, Math.round(resolution / Math.max(1, aspect)));
  const rows = Math.max(8, Math.round(resolution * Math.min(1, aspect)));
  const rng = randomSource(finite(seed, 7));
  const sharpness = clamp(finite(foldSharpness, 0.6), 0, 1);
  const foldTotal = Math.round(clamp(finite(foldCount, 6), 3, 16));
  const depth = clamp(finite(wrinkleDepth, 0.65), 0, 2);
  const count = (columns + 1) * (rows + 1);
  const original = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const index = row * (columns + 1) + col;
      const u = (col + (col > 0 && col < columns ? (rng() - 0.5) * 0.5 : 0)) / columns;
      const v = (row + (row > 0 && row < rows ? (rng() - 0.5) * 0.5 : 0)) / rows;
      original[index * 3] = u - 0.5;
      original[index * 3 + 1] = (v - 0.5) * aspect;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
      if (col < columns && row < rows) {
        const a = index,
          b = index + 1,
          c = index + columns + 1,
          d = c + 1;
        if (rng() > 0.5) indices.push(a, b, d, a, d, c);
        else indices.push(a, b, c, b, d, c);
      }
    }
  }
  return { aspect, shortSide, resolution, columns, rows, sharpness, foldTotal, depth, count, original, uvs, indices, rng };
}

export const paperPathKey = ({ paperWidth, paperHeight, resolution, foldTotal, sharpness, depth, seed }) =>
  JSON.stringify([paperWidth, paperHeight, resolution, foldTotal, sharpness, depth, seed]);

// Washi Type: a tileable normal map of crumpled-paper crinkles. Crumpled paper is a mosaic of
// small flat facets meeting at sharp ridges, so each pixel takes the tilt of its nearest
// random point (a Voronoi cell); two sizes of facets are layered. Returned as RGBA bytes.
export function createCrinkleNormals(size = 256, seed = 11) {
  const random = randomSource(seed);
  const layers = [
    { cells: 14, strength: 1 },
    { cells: 38, strength: 0.45 }
  ].map(({ cells, strength }) => {
    const points = new Float32Array(cells * cells * 4); // x, y, tiltX, tiltY per cell
    for (let i = 0; i < cells * cells; i++) {
      const cx = i % cells,
        cy = Math.floor(i / cells);
      points[i * 4] = (cx + 0.15 + random() * 0.7) / cells;
      points[i * 4 + 1] = (cy + 0.15 + random() * 0.7) / cells;
      points[i * 4 + 2] = (random() - 0.5) * 1.3;
      points[i * 4 + 3] = (random() - 0.5) * 1.3;
    }
    return { cells, strength, points };
  });
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size,
        v = (py + 0.5) / size;
      let nx = 0,
        ny = 0;
      for (const { cells, strength, points } of layers) {
        const gx = Math.floor(u * cells),
          gy = Math.floor(v * cells);
        let best = Infinity,
          second = Infinity,
          tx = 0,
          ty = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            // Wrap around so the texture tiles without seams.
            const cx = (gx + ox + cells) % cells,
              cy = (gy + oy + cells) % cells;
            const i = (cy * cells + cx) * 4;
            const dx = points[i] + (gx + ox - cx) / cells - u,
              dy = points[i + 1] + (gy + oy - cy) / cells - v;
            const d = dx * dx + dy * dy;
            if (d < best) {
              second = best;
              best = d;
              tx = points[i + 2];
              ty = points[i + 3];
            } else if (d < second) second = d;
          }
        }
        // A thin darker ridge where two facets meet.
        const edge = Math.sqrt(second) - Math.sqrt(best);
        const ridge = edge < 0.004 ? 0.35 : 0;
        nx += (tx + ridge) * strength;
        ny += (ty - ridge) * strength;
      }
      const length = Math.hypot(nx, ny, 1);
      const o = (py * size + px) * 4;
      data[o] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}
