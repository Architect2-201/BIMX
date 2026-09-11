const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const LandIntelligenceService = require('./lib/land-intelligence/land-intelligence-service');
const landIntelligenceService = new LandIntelligenceService();

let DxfWriter;
try {
  DxfWriter = require('dxf-writer');
} catch (e) {
  console.warn('dxf-writer not loaded:', e.message);
}

function generateR12Dxf(code, boundary, redLines, footprint, setback) {
  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n";
  dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n4\n";
  dxf += "0\nLAYER\n2\nCADASTRAL_BOUNDARY\n70\n0\n62\n1\n6\nCONTINUOUS\n";
  dxf += "0\nLAYER\n2\nRED_LINES\n70\n0\n62\n6\n6\nDASHED\n";
  dxf += "0\nLAYER\n2\nBUILDING_FOOTPRINT\n70\n0\n62\n4\n6\nCONTINUOUS\n";
  dxf += "0\nLAYER\n2\nSETBACKS_BUFFER\n70\n0\n62\n2\n6\nCONTINUOUS\n";
  dxf += "0\nENDTAB\n0\nENDSEC\n";
  dxf += "0\nSECTION\n2\nBLOCKS\n";
  dxf += "0\nBLOCK\n8\n0\n2\n*MODEL_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*MODEL_SPACE\n0\nENDBLK\n8\n0\n";
  dxf += "0\nBLOCK\n8\n0\n2\n*PAPER_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*PAPER_SPACE\n0\nENDBLK\n8\n0\n";
  dxf += "0\nENDSEC\n";
  dxf += "0\nSECTION\n2\nENTITIES\n";

  const addLines = (layerName, points) => {
    if (!points || points.length < 2) return;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      dxf += `0\nLINE\n8\n${layerName}\n10\n${Number(p1[0]).toFixed(3)}\n20\n${Number(p1[1]).toFixed(3)}\n30\n0.0\n11\n${Number(p2[0]).toFixed(3)}\n21\n${Number(p2[1]).toFixed(3)}\n31\n0.0\n`;
    }
  };

  addLines('CADASTRAL_BOUNDARY', boundary);
  addLines('RED_LINES', redLines);
  addLines('BUILDING_FOOTPRINT', footprint);
  addLines('SETBACKS_BUFFER', setback);

  dxf += "0\nENDSEC\n0\nEOF\n";
  return dxf;
}

const requestHandler = (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);

  // LAND INTELLIGENCE ENGINE GEORGIA - POST & GET /api/land-analysis
  if (parsedUrl.pathname === '/api/land-analysis') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const handleAnalysis = async (cadastralCode, constructionType, buildingUse, manualCoefficients, zoneOverride) => {
      if (!cadastralCode) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: "cadastralCode (საკადასტრო კოდი) აუცილებელია" }));
        return;
      }
      try {
        const result = await landIntelligenceService.analyzeLandParcel(
          cadastralCode,
          constructionType || 'new_construction',
          buildingUse || 'residential_single',
          manualCoefficients || null,
          zoneOverride || null
        );
        const statusCode = result.status === 'ERROR' ? 404 : 200;
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          handleAnalysis(
            payload.cadastralCode,
            payload.constructionType,
            payload.buildingUse,
            payload.manualCoefficients,
            payload.zoneOverride || payload.manualZone || payload.zone
          );
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    } else {
      // GET fallback for easy browser testing
      const code = parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('cadastralCode');
      const type = parsedUrl.searchParams.get('type') || parsedUrl.searchParams.get('constructionType');
      const use = parsedUrl.searchParams.get('use') || parsedUrl.searchParams.get('buildingUse');
      const zone = parsedUrl.searchParams.get('zone') || parsedUrl.searchParams.get('zoneOverride') || parsedUrl.searchParams.get('manualZone');
      handleAnalysis(code, type, use, null, zone);
      return;
    }
  }

  // Stateless NAPR / Cadastral Proxy route
  if (parsedUrl.pathname === '/api/parcel') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const cadastralCode = parsedUrl.searchParams.get('code');
    if (!cadastralCode) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: "cadastral code (code) query param აუცილებელია" }));
      return;
    }

    let normalizedCode = (cadastralCode || '').trim().replace(/[\s\-_/]+/g, '.');
    if (/^\d{11,14}$/.test(normalizedCode)) {
      normalizedCode = `${normalizedCode.slice(0, 2)}.${normalizedCode.slice(2, 4)}.${normalizedCode.slice(4, 6)}.${normalizedCode.slice(6, 9)}.${normalizedCode.slice(9)}`;
    }
    normalizedCode = normalizedCode.replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');

    const CADASTRAL_CODE_REGEX = /^\d{2}\.\d{1,3}\.\d{1,3}\.\d{1,4}(?:\.\d{1,4})?(?:[./]\d{1,4})?$/;
    if (!CADASTRAL_CODE_REGEX.test(normalizedCode)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: "საკადასტრო კოდის ფორმატი არასწორია (მაგ.: 01.10.09.001.001 ან 72.13.12.123)" }));
      return;
    }

    // Helper: Parse WKT POLYGON ((lng lat, ...)) into [[lat, lng], ...] for Leaflet & Three.js
    function parseWktPolygonToLatLng(wkt) {
      const match = wkt.match(/\(\((.+)\)\)/);
      if (!match) return [];
      return match[1].split(',').map(pair => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return [lat, lng]; // Leaflet coordinate order [lat, lng]
      });
    }

    // Helper: Calculate area in sqm
    function calculateAreaSqm(coordsLatLng) {
      if (!coordsLatLng || coordsLatLng.length < 3) return 0;
      let area = 0;
      const avgLat = coordsLatLng.reduce((sum, c) => sum + c[0], 0) / coordsLatLng.length;
      const metersPerDegLat = 111132.954;
      const metersPerDegLng = 111132.954 * Math.cos((avgLat * Math.PI) / 180);

      for (let i = 0; i < coordsLatLng.length - 1; i++) {
        const x1 = coordsLatLng[i][1] * metersPerDegLng;
        const y1 = coordsLatLng[i][0] * metersPerDegLat;
        const x2 = coordsLatLng[i + 1][1] * metersPerDegLng;
        const y2 = coordsLatLng[i + 1][0] * metersPerDegLat;
        area += (x1 * y2) - (x2 * y1);
      }
      return Math.abs(Math.round(area / 2));
    }

    // Live NAPR fetch with robust synthesizer fallback
    (async () => {
      try {
        const parcelRes = await landIntelligenceService.napr.getParcelByCadastralCode(normalizedCode);
        if (parcelRes && parcelRes.found) {
          let zoning = null;
          try {
            const reqZone = parsedUrl.searchParams.get('zone') || parsedUrl.searchParams.get('zoneOverride');
            const zoningAnalysis = landIntelligenceService.tbilisiZoning.resolveZoning(normalizedCode, parcelRes.centroid, parcelRes.areaSqm, reqZone);
            if (zoningAnalysis && zoningAnalysis.primaryZone) {
              const pz = zoningAnalysis.primaryZone;
              zoning = {
                zoneCode: pz.zoneCode,
                mainZoneKa: pz.mainZoneKa,
                mainZoneEn: pz.mainZoneEn || pz.mainZoneKa,
                subZoneKa: pz.subZoneKa,
                subZoneEn: pz.subZoneEn || pz.subZoneKa,
                tabLabelKa: pz.tabLabelKa,
                zoneNameKa: pz.zoneNameKa,
                zoneNameEn: pz.zoneNameEn,
                k1: pz.k1,
                k2: pz.k2,
                k3: pz.k3,
                colorHex: pz.colorHex
              };
            }
          } catch (zErr) {
            console.warn('[Server] Error resolving zoning for', normalizedCode, zErr);
          }

          let tasProjects = null;
          try {
            const k1 = (zoning && zoning.k1 != null) ? zoning.k1 : 0.5;
            const k2 = (zoning && zoning.k2 != null) ? zoning.k2 : 1.5;
            const k3 = (zoning && zoning.k3 != null) ? zoning.k3 : 0.3;
            tasProjects = landIntelligenceService.tasProjects.getApprovedProjectsAndCapacity(
              normalizedCode,
              parcelRes.areaSqm,
              k1,
              k2,
              k3,
              parcelRes.centroid
            );
          } catch (tErr) {
            console.warn('[Server] Error resolving TAS projects for', normalizedCode, tErr);
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            status: true,
            cadastralCode: parcelRes.cadastralCode,
            address: parcelRes.address,
            areaSqm: parcelRes.areaSqm,
            coordinates: parcelRes.boundary, // [lat, lng] array
            shapeWkt: parcelRes.shapeWkt,
            centroid: parcelRes.centroid,
            dimensions: parcelRes.dimensions,
            source: parcelRes.source,
            portalUrl: parcelRes.portalUrl,
            zoning: zoning,
            tasProjects: tasProjects,
            approvedProjects: tasProjects ? tasProjects.projects : [],
            remainingCapacity: tasProjects ? tasProjects.remaining : null
          }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: false,
          error: "ნაკვეთი მითითებული საკადასტრო კოდით ვერ მოიძებნა",
          code: normalizedCode,
          portalUrl: "https://maps.gov.ge/map/portal"
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          error: "NAPR service connection error: " + (err.message || err),
          code: normalizedCode,
          portalUrl: "https://maps.gov.ge/map/portal"
        }));
      }
    })();
    return;
  }

  // Helper: Fallback procedural urban fabric around coordinates (if Overpass times out)
  function generateProceduralUrbanFabric(centerLat, centerLng) {
    const buildings = [];
    const metersPerDegLat = 111132.954;
    const metersPerDegLng = 111132.954 * Math.cos((centerLat * Math.PI) / 180);

    const offsets = [
      // Close neighbors (35m - 90m)
      { dx: 45, dy: 30, w: 24, l: 32, rot: 15, h: 16.0, lv: 5 },
      { dx: -55, dy: 20, w: 28, l: 20, rot: -10, h: 12.8, lv: 4 },
      { dx: 30, dy: -60, w: 35, l: 22, rot: 5, h: 22.4, lv: 7 },
      { dx: -40, dy: -55, w: 20, l: 30, rot: 25, h: 9.6, lv: 3 },
      // Mid ring (100m - 180m)
      { dx: 110, dy: 50, w: 32, l: 40, rot: 12, h: 28.8, lv: 9 },
      { dx: 85, dy: 120, w: 26, l: 26, rot: -18, h: 16.0, lv: 5 },
      { dx: -110, dy: 80, w: 38, l: 24, rot: 8, h: 19.2, lv: 6 },
      { dx: -90, dy: -110, w: 30, l: 35, rot: -15, h: 12.8, lv: 4 },
      { dx: 60, dy: -130, w: 42, l: 28, rot: 20, h: 25.6, lv: 8 },
      { dx: -130, dy: -40, w: 25, l: 25, rot: 0, h: 9.6, lv: 3 },
      // Outer perimeter (190m - 280m)
      { dx: 180, dy: 90, w: 45, l: 35, rot: 30, h: 32.0, lv: 10 },
      { dx: 150, dy: -160, w: 36, l: 30, rot: -25, h: 16.0, lv: 5 },
      { dx: -170, dy: 140, w: 32, l: 48, rot: 10, h: 22.4, lv: 7 },
      { dx: -190, dy: -120, w: 40, l: 28, rot: -5, h: 12.8, lv: 4 },
      { dx: 0, dy: 160, w: 30, l: 32, rot: 15, h: 19.2, lv: 6 },
      { dx: -10, dy: -180, w: 44, l: 26, rot: -12, h: 16.0, lv: 5 }
    ];

    offsets.forEach((b, idx) => {
      const cos = Math.cos((b.rot * Math.PI) / 180);
      const sin = Math.sin((b.rot * Math.PI) / 180);
      const hw = b.w / 2;
      const hl = b.l / 2;

      const cornersMeters = [
        { x: b.dx + (-hw * cos - -hl * sin), y: b.dy + (-hw * sin + -hl * cos) },
        { x: b.dx + (hw * cos - -hl * sin),  y: b.dy + (hw * sin + -hl * cos) },
        { x: b.dx + (hw * cos - hl * sin),   y: b.dy + (hw * sin + hl * cos) },
        { x: b.dx + (-hw * cos - hl * sin),  y: b.dy + (-hw * sin + hl * cos) }
      ];

      const polyGps = cornersMeters.map(pt => [
        centerLat + pt.y / metersPerDegLat,
        centerLng + pt.x / metersPerDegLng
      ]);

      buildings.push({
        id: `proc-bldg-${idx + 1}`,
        height: b.h,
        levels: b.lv,
        coordinates: polyGps,
        isProcedural: true
      });
    });

    return buildings;
  }

  // 1B. OpenStreetMap Overpass API: Surrounding 3D Urban Fabric (within 350m)
  if (parsedUrl.pathname === '/api/overpass') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const lat = parseFloat(parsedUrl.searchParams.get('lat') || '41.7151');
    const lng = parseFloat(parsedUrl.searchParams.get('lng') || '44.8271');
    const radius = Math.min(1200, Math.max(100, parseInt(parsedUrl.searchParams.get('radius') || '350', 10)));

    const overpassQuery = `[out:json][timeout:25];(way["building"](around:${radius},${lat},${lng});relation["building"](around:${radius},${lat},${lng}););out body;>;out skel qt;`;

    const mirrors = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter'
    ];

    (async () => {
      let ways = [];
      let nodeMap = {};
      let fetchSuccess = false;

      for (const mirror of mirrors) {
        try {
          const mirrorUrl = `${mirror}?data=${encodeURIComponent(overpassQuery)}`;
          const rawData = await new Promise((resolve, reject) => {
            const req = https.get(mirrorUrl, {
              headers: {
                'User-Agent': 'curl/8.4.0',
                'Accept': 'application/json'
              },
              timeout: 14000
            }, res => {
              if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
              let body = '';
              res.on('data', chunk => body += chunk);
              res.on('end', () => resolve(body));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
          });

          if (rawData) {
            const parsed = JSON.parse(rawData);
            (parsed.elements || []).forEach(elem => {
              if (elem.type === 'node') {
                nodeMap[elem.id] = [elem.lat, elem.lon];
              } else if (elem.type === 'way' && elem.tags && elem.tags.building) {
                ways.push(elem);
              }
            });
            if (ways.length > 0) {
              fetchSuccess = true;
              break;
            }
          }
        } catch (mirrorErr) {
          console.warn(`[Server] Overpass mirror ${mirror} warning:`, mirrorErr.message);
        }
      }

      if (fetchSuccess && ways.length > 0) {
        const buildings = [];
        ways.forEach(way => {
          if (!way.nodes || way.nodes.length < 3) return;
          const coords = [];
          for (const nid of way.nodes) {
            if (nodeMap[nid]) coords.push(nodeMap[nid]);
          }
          if (coords.length >= 3) {
            const bType = (way.tags.building || 'yes').toLowerCase();
            let useType = 'residential';
            let levels = 3;
            let height = 9.6;

            if (bType === 'industrial' || way.tags.man_made === 'works' || way.tags.landuse === 'industrial') {
              useType = 'industrial';
              levels = way.tags['building:levels'] ? parseInt(way.tags['building:levels'], 10) : 1;
              height = way.tags.height ? parseFloat(way.tags.height) : (levels * 6.5);
            } else if (bType === 'garages' || bType === 'garage') {
              useType = 'garage';
              levels = 1;
              height = 3.2;
            } else if (bType === 'church' || way.tags.amenity === 'place_of_worship') {
              useType = 'worship';
              levels = 1;
              height = 9.5;
            } else if (bType === 'apartments') {
              useType = 'residential';
              levels = way.tags['building:levels'] ? parseInt(way.tags['building:levels'], 10) : 5;
              height = way.tags.height ? parseFloat(way.tags.height) : (levels * 3.2);
            } else if (bType === 'commercial' || bType === 'retail' || bType === 'supermarket') {
              useType = 'commercial';
              levels = way.tags['building:levels'] ? parseInt(way.tags['building:levels'], 10) : 2;
              height = way.tags.height ? parseFloat(way.tags.height) : (levels * 4.0);
            } else if (bType === 'office') {
              useType = 'office';
              levels = way.tags['building:levels'] ? parseInt(way.tags['building:levels'], 10) : 4;
              height = way.tags.height ? parseFloat(way.tags.height) : (levels * 3.6);
            } else if (way.tags['building:levels']) {
              levels = Math.max(1, parseInt(way.tags['building:levels'], 10) || 1);
              height = way.tags.height ? parseFloat(way.tags.height) : (levels * 3.2);
            } else if (way.tags.height) {
              height = parseFloat(way.tags.height);
              levels = Math.max(1, Math.round(height / 3.2));
            }

            buildings.push({
              id: `osm-${way.id}`,
              name: way.tags.name || way.tags['name:ka'] || way.tags['name:en'] || null,
              housenumber: way.tags['addr:housenumber'] || null,
              street: way.tags['addr:street'] || way.tags['addr:street:ka'] || null,
              buildingType: bType,
              useType: useType,
              roofShape: way.tags['roof:shape'] || 'flat',
              height: parseFloat(height.toFixed(1)),
              levels: levels,
              coordinates: coords,
              isProcedural: false
            });
          }
        });

        if (buildings.length > 0 && !res.headersSent) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'OK', source: 'overpass', count: buildings.length, buildings: buildings }));
          return;
        }
      }

      // If empty result or all mirrors failed, fallback gracefully (flagged as procedural)
      if (!res.headersSent) {
        const fallback = generateProceduralUrbanFabric(lat, lng);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'OK', source: 'procedural_fallback', count: fallback.length, buildings: fallback }));
      }
    })();
    return;
  }

  // 1C. DEM / Elevation & Topography Slope API
  if (parsedUrl.pathname === '/api/elevation') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const lat = parseFloat(parsedUrl.searchParams.get('lat') || '41.7151');
    const lng = parseFloat(parsedUrl.searchParams.get('lng') || '44.8271');

    // Base elevation model for Tbilisi based on geographical coordinates
    // Saburtalo ~ 450-520m, Vake ~ 480-560m, Old Tbilisi ~ 390-430m, Mtatsminda ~ 600-750m, Didi Dighomi ~ 510-540m
    function estimateTbilisiElevation(la, lo) {
      const baseLat = 41.7151;
      const baseLng = 44.8271;
      const dLat = (la - baseLat) * 111000;
      const dLng = (lo - baseLng) * 82000;
      // Realistic topographical formula for Tbilisi basin
      const elev = 430 + (dLat * 0.015) - (dLng * 0.008) + Math.sin(la * 500) * 12 + Math.cos(lo * 500) * 8;
      return Math.round(elev * 10) / 10;
    }

    // Attempt Open-Elevation query with timeout fallback
    const openElevUrl = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
    const elevReq = https.get(openElevUrl, { timeout: 3500 }, (elevRes) => {
      let data = '';
      elevRes.on('data', c => { data += c; });
      elevRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.results && parsed.results[0] && typeof parsed.results[0].elevation === 'number') {
            const el = parsed.results[0].elevation;
            if (!res.headersSent) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ status: 'OK', elevation: el, source: 'open-elevation' }));
            }
            return;
          }
        } catch (e) {}
        if (!res.headersSent) {
          const est = estimateTbilisiElevation(lat, lng);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'OK', elevation: est, source: 'topographical_model' }));
        }
      });
    });

    elevReq.on('error', () => {
      if (!res.headersSent) {
        const est = estimateTbilisiElevation(lat, lng);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'OK', elevation: est, source: 'topographical_model' }));
      }
    });

    elevReq.on('timeout', () => {
      elevReq.destroy();
      if (!res.headersSent) {
        const est = estimateTbilisiElevation(lat, lng);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'OK', elevation: est, source: 'topographical_model' }));
      }
    });
    return;
  }

  // 1D. AutoCAD & Revit Compliant DXF Export API (dxf-writer)
  if (parsedUrl.pathname === '/api/export-dxf') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const generateDxfFromPayload = (payload) => {
      const code = payload.cadastralCode || 'Parcel';
      const boundary = payload.boundary || [];
      const redLines = payload.redLines || [];
      const footprint = payload.footprint || [];
      const setback = payload.setback || [];

      if (!DxfWriter) {
        return generateR12Dxf(code, boundary, redLines, footprint, setback);
      }

      try {
        const d = new DxfWriter();
        d.setUnits('Meters');
        d.addLayer('CADASTRAL_BOUNDARY', 1, 'CONTINUOUS');
        d.addLayer('RED_LINES', 6, 'DASHED');
        d.addLayer('BUILDING_FOOTPRINT', 4, 'CONTINUOUS');
        d.addLayer('SETBACKS_BUFFER', 2, 'CONTINUOUS');

        const drawLoop = (layerName, points) => {
          if (!points || points.length < 2) return;
          d.setActiveLayer(layerName);
          const pts = points.map(p => [Number(p[0]), Number(p[1])]);
          const first = pts[0];
          const last = pts[pts.length - 1];
          if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.001) {
            pts.push([first[0], first[1]]);
          }
          d.drawPolyline(pts);
        };

        drawLoop('CADASTRAL_BOUNDARY', boundary);
        drawLoop('RED_LINES', redLines);
        drawLoop('BUILDING_FOOTPRINT', footprint);
        drawLoop('SETBACKS_BUFFER', setback);

        return d.toDxfString();
      } catch (err) {
        console.warn('dxf-writer fallback triggered:', err.message);
        return generateR12Dxf(code, boundary, redLines, footprint, setback);
      }
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const dxfContent = generateDxfFromPayload(payload);
          res.writeHead(200, {
            'Content-Type': 'application/dxf; charset=utf-8',
            'Content-Disposition': `attachment; filename="BIMX_${payload.cadastralCode || 'Parcel'}_Layers.dxf"`
          });
          res.end(dxfContent);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    } else {
      const dxfContent = generateDxfFromPayload({ cadastralCode: 'Sample' });
      res.writeHead(200, {
        'Content-Type': 'application/dxf; charset=utf-8',
        'Content-Disposition': 'attachment; filename="BIMX_Sample_Layers.dxf"'
      });
      res.end(dxfContent);
      return;
    }
  }

  let reqPath = decodeURI(parsedUrl.pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath);

  // If file doesn't exist and has no extension, try with .html
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
};

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`BIMX server running at http://localhost:${PORT}`);
  });
}

module.exports = requestHandler;
module.exports.server = server;
