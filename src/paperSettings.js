// The specimen sheet's paper. The same settings for every font, so the fold simulation runs
// once (in the background, see App.jsx) and every sheet opens with it ready.
export const SHEET_PAPER = {
  width: 360,
  height: 460,
  detail: 128, // 25 x 32 points, 1,600 triangles (was 13 x 16, 416)
  seed: 13,
  foldCount: 11, // crease lines (was 7)
  foldSharpness: 0.78, // crisper creases (was 0.6)
  wrinkleDepth: 0.95 // deeper buckling (was 0.65)
};
