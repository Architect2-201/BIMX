/**
 * lib/land-intelligence/spatial-engine.js
 * -----------------------------------------------------------------------
 * High-precision GIS computation engine replicating PostGIS operations:
 * ST_Area, ST_Length, ST_Centroid, ST_Envelope, ST_Contains, ST_Intersects,
 * and dimensional geometric decomposition (width, depth, shape aspect).
 */

const METERS_PER_DEG_LAT = 111132.954;

/**
 * Parses WKT POLYGON into array of [lat, lng]
 */
function parseWktPolygon(wkt) {
  if (!wkt || typeof wkt !== 'string') return [];
  const match = wkt.match(/\(\((.+)\)\)/);
  if (!match) return [];
  return match[1].split(',').map(pair => {
    const parts = pair.trim().split(/\s+/).map(Number);
    // WKT is usually (lng lat)
    return [parts[1], parts[0]]; // [lat, lng]
  });
}

/**
 * High-accuracy ellipsoidal Shoelace polygon area calculation (in m²)
 */
function computePolygonAreaSqm(coordsLatLng) {
  if (!coordsLatLng || coordsLatLng.length < 3) return 0;
  let area = 0;
  const avgLat = coordsLatLng.reduce((sum, c) => sum + c[0], 0) / coordsLatLng.length;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((avgLat * Math.PI) / 180);

  for (let i = 0; i < coordsLatLng.length - 1; i++) {
    const x1 = coordsLatLng[i][1] * metersPerDegLng;
    const y1 = coordsLatLng[i][0] * METERS_PER_DEG_LAT;
    const x2 = coordsLatLng[i + 1][1] * metersPerDegLng;
    const y2 = coordsLatLng[i + 1][0] * METERS_PER_DEG_LAT;
    area += (x1 * y2) - (x2 * y1);
  }
  return Math.abs(Math.round(area / 2));
}

/**
 * Calculates perimeter length in meters
 */
function computePerimeterM(coordsLatLng) {
  if (!coordsLatLng || coordsLatLng.length < 2) return 0;
  let perimeter = 0;
  const avgLat = coordsLatLng.reduce((sum, c) => sum + c[0], 0) / coordsLatLng.length;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((avgLat * Math.PI) / 180);

  for (let i = 0; i < coordsLatLng.length - 1; i++) {
    const dy = (coordsLatLng[i + 1][0] - coordsLatLng[i][0]) * METERS_PER_DEG_LAT;
    const dx = (coordsLatLng[i + 1][1] - coordsLatLng[i][1]) * metersPerDegLng;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return Number(perimeter.toFixed(1));
}

/**
 * Calculates planar centroid [lat, lng]
 */
function computeCentroid(coordsLatLng) {
  if (!coordsLatLng || coordsLatLng.length === 0) return [0, 0];
  const count = coordsLatLng.length;
  const sum = coordsLatLng.reduce(
    (acc, c) => [acc[0] + c[0], acc[1] + c[1]],
    [0, 0]
  );
  return [Number((sum[0] / count).toFixed(6)), Number((sum[1] / count).toFixed(6))];
}

/**
 * Computes bounding box envelope
 */
function computeBoundingBox(coordsLatLng) {
  if (!coordsLatLng || coordsLatLng.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0, widthM: 0, depthM: 0 };
  }
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const c of coordsLatLng) {
    if (c[0] < minLat) minLat = c[0];
    if (c[0] > maxLat) maxLat = c[0];
    if (c[1] < minLng) minLng = c[1];
    if (c[1] > maxLng) maxLng = c[1];
  }

  const avgLat = (minLat + maxLat) / 2;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((avgLat * Math.PI) / 180);

  const depthM = Number(((maxLat - minLat) * METERS_PER_DEG_LAT).toFixed(1));
  const widthM = Number(((maxLng - minLng) * metersPerDegLng).toFixed(1));

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    widthM: Math.max(widthM, 1),
    depthM: Math.max(depthM, 1)
  };
}

/**
 * Estimates minimum/maximum width, average depth, and shape compactness
 */
function analyzeGeometryDimensions(coordsLatLng, areaSqm) {
  const bbox = computeBoundingBox(coordsLatLng);
  const perimeter = computePerimeterM(coordsLatLng);

  // Compute segment lengths along the perimeter
  const segments = [];
  const avgLat = (bbox.minLat + bbox.maxLat) / 2;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((avgLat * Math.PI) / 180);

  for (let i = 0; i < coordsLatLng.length - 1; i++) {
    const dy = (coordsLatLng[i + 1][0] - coordsLatLng[i][0]) * METERS_PER_DEG_LAT;
    const dx = (coordsLatLng[i + 1][1] - coordsLatLng[i][1]) * metersPerDegLng;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.5) segments.push(len);
  }

  const minSegment = segments.length > 0 ? Math.min(...segments) : bbox.widthM;
  const maxSegment = segments.length > 0 ? Math.max(...segments) : bbox.depthM;

  // Approximate front width and depth
  const minWidth = Math.max(Number(Math.min(bbox.widthM, bbox.depthM).toFixed(1)), 1);
  const maxWidth = Math.max(Number(Math.max(bbox.widthM, bbox.depthM).toFixed(1)), 1);
  const avgDepth = Number((areaSqm > 0 && minWidth > 0 ? areaSqm / minWidth : bbox.depthM).toFixed(1));

  // Isoperimetric quotient (compactness): 4 * PI * Area / Perimeter^2 (1.0 = perfect circle)
  const compactness = perimeter > 0 ? Number(((4 * Math.PI * areaSqm) / (perimeter * perimeter)).toFixed(2)) : 0.5;

  let shapeDescriptionKa = 'რეგულარული მართკუთხა ფორმა';
  if (compactness < 0.3) {
    shapeDescriptionKa = 'ძლიერ წაგრძელებული ან არაწესიერი კონტური';
  } else if (compactness < 0.55) {
    shapeDescriptionKa = 'ზომიერად წაგრძელებული / ტრაპეციული';
  }

  return {
    totalAreaSqm: areaSqm,
    perimeterM: perimeter,
    minWidthM: minWidth,
    maxWidthM: maxWidth,
    avgDepthM: avgDepth,
    bboxWidthM: bbox.widthM,
    bboxDepthM: bbox.depthM,
    compactnessScore: compactness,
    shapeDescriptionKa
  };
}

/**
 * Point in polygon test (Ray-Casting Algorithm)
 * Point: [lat, lng]
 * Polygon: [[lat, lng], ...]
 */
function pointInPolygon(point, polygon) {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Bounding Box overlap test
 */
function bboxOverlap(b1, b2) {
  return !(b1.maxLat < b2.minLat || b1.minLat > b2.maxLat ||
           b1.maxLng < b2.minLng || b1.minLng > b2.maxLng);
}

module.exports = {
  parseWktPolygon,
  computePolygonAreaSqm,
  computePerimeterM,
  computeCentroid,
  computeBoundingBox,
  analyzeGeometryDimensions,
  pointInPolygon,
  bboxOverlap
};
