/**
 * Lon/lat polygons + fit/project math copied from the Ranch House Radio
 * mockups. Add one array per new state; missing keys fall back to a
 * parchment beacon with no outline.
 */
export type LonLat = [number, number];

export const STATE_SHAPES: Record<string, LonLat[]> = {
  TX: [
    [-106.6, 32],
    [-103.06, 32],
    [-103.06, 36.5],
    [-100, 36.5],
    [-100, 34.56],
    [-99.5, 34.4],
    [-97.5, 33.9],
    [-96.5, 33.8],
    [-94.04, 33.55],
    [-94.04, 31.0],
    [-93.7, 30.1],
    [-93.9, 29.7],
    [-95.5, 28.8],
    [-97, 28],
    [-97.15, 25.9],
    [-99.1, 26.4],
    [-99.5, 27.5],
    [-101.4, 29.8],
    [-103.1, 28.9],
    [-104.9, 29.6],
    [-106.5, 31.8],
  ],
  FL: [
    [-87.6, 30.98],
    [-85.0, 31.0],
    [-82.2, 30.53],
    [-81.4, 30.7],
    [-80.5, 28.5],
    [-80.05, 26.8],
    [-80.1, 25.2],
    [-81.1, 25.2],
    [-81.7, 26.0],
    [-82.7, 27.9],
    [-82.85, 29.1],
    [-84, 30.1],
    [-85.3, 29.7],
    [-86.2, 30.4],
    [-87.5, 30.3],
  ],
  TN: [
    [-90.31, 35.0],
    [-90.22, 35.45],
    [-89.97, 35.97],
    [-89.73, 36.3],
    [-89.54, 36.5],
    [-88.07, 36.5],
    [-86.37, 36.68],
    [-84.15, 36.61],
    [-81.65, 36.59],
    [-81.68, 36.28],
    [-82.05, 35.97],
    [-83.47, 35.43],
    [-84.02, 34.98],
    [-85.61, 34.98],
    [-88.07, 35.0],
    [-90.31, 35.0],
  ],
  PA: [
    [-80.52, 39.72],
    [-75.8, 39.72],
    [-74.7, 40.2],
    [-75.1, 40.95],
    [-74.8, 41.35],
    [-75.35, 42.0],
    [-79.76, 42.0],
    [-79.76, 42.27],
    [-80.52, 42.33],
  ],
  AR: [
    [-94.62, 36.5],
    [-90.16, 36.5],
    [-89.66, 35.97],
    [-90.3, 35.0],
    [-91.07, 33.97],
    [-91.16, 33.02],
    [-94.04, 33.02],
    [-94.48, 33.64],
    [-94.43, 35.4],
    [-94.62, 36.5],
  ],
  CA: [
    [-124.2, 41.99],
    [-124.35, 40.3],
    [-123.7, 38.9],
    [-122.4, 37.75],
    [-121.9, 36.55],
    [-120.65, 34.57],
    [-118.3, 33.7],
    [-117.15, 32.55],
    [-114.72, 32.72],
    [-114.15, 34.27],
    [-114.6, 35.05],
    [-120.0, 39.0],
    [-120.0, 42.0],
  ],
};

export type ProjectedPoint = { x: number; y: number };

export type ShapeProjection = {
  points: string;
  project: (lon: number, lat: number) => ProjectedPoint;
};

export function fitStateShape(
  pts: LonLat[],
  width: number,
  height: number,
  padding = 16,
): ShapeProjection {
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const mnLo = Math.min(...lons);
  const mxLo = Math.max(...lons);
  const mnLa = Math.min(...lats);
  const mxLa = Math.max(...lats);
  const dLo = Math.max(mxLo - mnLo, 0.0001);
  const dLa = Math.max(mxLa - mnLa, 0.0001);
  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scX = innerW / dLo;
  const scYUniform = innerH / dLa;
  const sc = Math.min(scX, scYUniform);
  // Wide, short states (Tennessee) collapse to a sliver under a uniform
  // lon/lat scale. Floor vertical fill so the outline still reads, without
  // stretching compact states like Texas or California into the full frame.
  const scY = Math.min(scYUniform, Math.max(sc, (innerH * 0.42) / dLa));
  const ox = (width - dLo * sc) / 2;
  const oy = (height - dLa * scY) / 2;
  const project = (lon: number, lat: number): ProjectedPoint => ({
    x: ox + (lon - mnLo) * sc,
    y: oy + (mxLa - lat) * scY,
  });
  return {
    points: pts
      .map((p) => {
        const pt = project(p[0], p[1]);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(" "),
    project,
  };
}
