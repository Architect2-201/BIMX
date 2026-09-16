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

const TasPrecedentsEngine = require('./lib/land-intelligence/tas-precedents-engine');
const tasPrecedentsEngine = new TasPrecedentsEngine();

const CirculationEngine = require('./lib/land-intelligence/circulation-engine');
const circulationEngine = new CirculationEngine();

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
function universalNormalizeCadastral(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return '';
  let clean = rawCode.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();
  // Strip common prefixes like 'საკადასტრო:', '№', 'N', 'code:' etc.
  clean = clean.replace(/^(?:საკადასტრო(?: კოდი)?:?|№|N|code:?)\s*/i, '');
  let parts = clean.split(/[^\d]+/).filter(Boolean);
  if (parts.length === 0) return '';

  if (parts.length === 1) {
    let digits = parts[0];
    if (digits.length === 11) digits = '0' + digits;
    if (digits.length === 12) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`;
    }
    if (digits.length >= 13) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`;
    }
    if (digits.length === 9 || digits.length === 10) {
      if (digits.length === 9) digits = '0' + digits;
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
    }
  }

  if (parts.length > 5) parts = parts.slice(0, 5);

  if (parts.length === 5) {
    return [
      parts[0].padStart(2, '0'),
      parts[1].padStart(2, '0'),
      parts[2].padStart(2, '0'),
      parts[3].padStart(3, '0'),
      parts[4].padStart(3, '0')
    ].join('.');
  }

  if (parts.length === 4) {
    return [
      parts[0].padStart(2, '0'),
      parts[1].padStart(2, '0'),
      parts[2].padStart(2, '0'),
      parts[3].padStart(3, '0')
    ].join('.');
  }

  if (parts.length === 3) {
    return [
      parts[0].padStart(2, '0'),
      parts[1].padStart(2, '0'),
      parts[2].padStart(2, '0')
    ].join('.');
  }

  return parts.join('.');
}

// Module-level in-memory cache for Surroundings POIs
const surroundingsPoiCache = new Map();

// Request Handler for Node HTTP & Serverless Cloud
const requestHandler = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);

  // API route for Full Land Intelligence Analysis
  if (parsedUrl.pathname === '/api/land-analysis') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const handleAnalysis = async (cadastralCode, constructionType, buildingUse, manualCoefficients, zoneOverride) => {
      const normalizedCode = universalNormalizeCadastral(cadastralCode);
      if (!normalizedCode) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: "cadastralCode (საკადასტრო კოდი) აუცილებელია" }));
        return;
      }
      try {
        const result = await landIntelligenceService.analyzeLandParcel(
          normalizedCode,
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

    const normalizedCode = universalNormalizeCadastral(cadastralCode);

    const CADASTRAL_CODE_REGEX = /^\d{2}(?:\.\d{1,6}){2,5}(?:[./]\d{1,6})?$/;
    if (!CADASTRAL_CODE_REGEX.test(normalizedCode)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: "საკადასტრო კოდის ფორმატი არასწორია (მაგ.: 01.10.09.001.001 ან 72.13.12.123)" }));
      return;
    }

    // Helper: Parse WKT POLYGON / MULTIPOLYGON ((lng lat, ...)) into [[lat, lng], ...] for Leaflet & Three.js
    function parseWktPolygonToLatLng(wkt) {
      if (!wkt || typeof wkt !== 'string') return [];
      const clean = wkt.replace(/^(?:MULTI)?POLYGON\s*/i, '');
      const coordRegex = /([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)/g;
      const points = [];
      let m;
      while ((m = coordRegex.exec(clean)) !== null) {
        const lng = parseFloat(m[1]);
        const lat = parseFloat(m[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          points.push([lat, lng]); // Leaflet coordinate order [lat, lng]
        }
      }
      return points;
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
          notFound: true,
          error: "საკადასტრო კოდი საჯარო რეესტრის (NAPR) ოფიციალურ ბაზაში ვერ მოიძებნა",
          code: normalizedCode,
          portalUrl: "https://maps.gov.ge/map/portal"
        }));
      } catch (err) {
        console.warn('[Server] NAPR provider error for', normalizedCode, '—', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: false,
          error: "საჯარო რეესტრის სერვისთან კავშირი დროებით შეფერხებულია: " + (err.message || err),
          code: normalizedCode,
          portalUrl: "https://maps.gov.ge/map/portal"
        }));
      }
    })();
    return;
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

    (async () => {
      let buildings = [];

      // 1. Primary: Official OpenStreetMap API 0.6 bbox query (responds in ~900ms worldwide)
      try {
        const dDegLat = radius / 111139;
        const dDegLng = radius / (111139 * Math.cos(lat * Math.PI / 180));
        const minLng = (lng - dDegLng).toFixed(6);
        const maxLng = (lng + dDegLng).toFixed(6);
        const minLat = (lat - dDegLat).toFixed(6);
        const maxLat = (lat + dDegLat).toFixed(6);

        const osmUrl = `https://api.openstreetmap.org/api/0.6/map?bbox=${minLng},${minLat},${maxLng},${maxLat}`;
        const osmRes = await fetch(osmUrl, {
          headers: {
            'User-Agent': 'BIMXCadastral/2.0 (admin@bimx.ge)',
            'Accept': 'application/xml, text/xml, */*'
          },
          signal: AbortSignal.timeout(6000)
        });

        if (osmRes.ok) {
          const xml = await osmRes.text();
          const nodeMap = new Map();
          const nodeRegex = /<node\s+[^>]*?id="(\d+)"[^>]*?lat="([\d.-]+)"[^>]*?lon="([\d.-]+)"/g;
          let m;
          while ((m = nodeRegex.exec(xml)) !== null) {
            nodeMap.set(m[1], [parseFloat(m[2]), parseFloat(m[3])]);
          }
          const nodeRegex2 = /<node\s+[^>]*?id="(\d+)"[^>]*?lon="([\d.-]+)"[^>]*?lat="([\d.-]+)"/g;
          while ((m = nodeRegex2.exec(xml)) !== null) {
            nodeMap.set(m[1], [parseFloat(m[3]), parseFloat(m[2])]);
          }

          const wayRegex = /<way\s+[^>]*?id="(\d+)"[\s\S]*?<\/way>/g;
          while ((m = wayRegex.exec(xml)) !== null) {
            const wayBlock = m[0];
            const wayId = m[1];
            if (!wayBlock.includes('k="building"')) continue;

            const ndRegex = /<nd\s+[^>]*?ref="(\d+)"/g;
            let ndMatch;
            const coords = [];
            while ((ndMatch = ndRegex.exec(wayBlock)) !== null) {
              const pt = nodeMap.get(ndMatch[1]);
              if (pt) coords.push(pt);
            }

            if (coords.length < 3) continue;

            const tagRegex = /<tag\s+[^>]*?k="([^"]+)"\s+v="([^"]*)"/g;
            const tags = {};
            let tMatch;
            while ((tMatch = tagRegex.exec(wayBlock)) !== null) {
              tags[tMatch[1]] = tMatch[2];
            }

            const bType = (tags.building || 'yes').toLowerCase();
            let useType = 'residential';
            let levels = tags['building:levels'] ? parseInt(tags['building:levels'], 10) : 3;
            let height = tags.height ? parseFloat(tags.height) : (levels * 3.3);

            if (bType === 'commercial' || bType === 'retail' || bType === 'supermarket' || tags.shop) {
              useType = 'commercial';
              height = levels * 4.0;
            } else if (bType === 'office') {
              useType = 'office';
              height = levels * 3.6;
            } else if (bType === 'industrial' || tags.landuse === 'industrial') {
              useType = 'industrial';
              height = Math.max(6.0, levels * 5.5);
            } else if (bType === 'garage' || bType === 'garages') {
              useType = 'garage';
              levels = 1;
              height = 3.2;
            } else if (bType === 'church' || bType === 'cathedral' || tags.amenity === 'place_of_worship') {
              useType = 'worship';
              height = 10.5;
            }

            buildings.push({
              id: `osm-${wayId}`,
              name: tags['name:ka'] || tags.name || null,
              nameEn: tags['name:en'] || tags.name || null,
              housenumber: tags['addr:housenumber'] || null,
              street: tags['addr:street'] || tags['addr:street:ka'] || null,
              buildingType: bType,
              useType: useType,
              roofShape: tags['roof:shape'] || 'flat',
              height: parseFloat(height.toFixed(1)),
              levels: levels,
              coordinates: coords,
              isProcedural: false
            });
          }
        }
      } catch (osmErr) {
        console.warn('[Server] OSM official API fetch note:', osmErr.message);
      }

      // 2. Secondary fallback: Overpass mirrors if OSM official was throttled
      if (buildings.length === 0) {
        try {
          const overpassQuery = `[out:json][timeout:8];way["building"](around:${radius},${lat},${lng});out body;>;out skel qt;`;
          const postBody = `data=${encodeURIComponent(overpassQuery)}`;
          const mirrors = [
            'https://lz4.overpass-api.de/api/interpreter',
            'https://overpass-api.de/api/interpreter'
          ];
          for (const m of mirrors) {
            try {
              const res = await fetch(m, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': 'BIMXCadastral/2.0 (admin@bimx.ge)',
                  'Accept': 'application/json'
                },
                body: postBody,
                signal: AbortSignal.timeout(6000)
              });
              if (res.ok) {
                const fastestResult = await res.json();
                if (fastestResult && fastestResult.elements) {
                  const nodeMap = {};
                  const ways = [];
                  fastestResult.elements.forEach(elem => {
                    if (elem.type === 'node') nodeMap[elem.id] = [elem.lat, elem.lon];
                    else if (elem.type === 'way' && elem.tags && elem.tags.building) ways.push(elem);
                  });
                  ways.forEach(way => {
                    if (!way.nodes || way.nodes.length < 3) return;
                    const coords = [];
                    for (const nid of way.nodes) {
                      if (nodeMap[nid]) coords.push(nodeMap[nid]);
                    }
                    if (coords.length >= 3) {
                      const bType = (way.tags.building || 'yes').toLowerCase();
                      const levels = way.tags['building:levels'] ? parseInt(way.tags['building:levels'], 10) : 3;
                      const height = way.tags.height ? parseFloat(way.tags.height) : (levels * 3.3);
                      buildings.push({
                        id: `osm-${way.id}`,
                        name: way.tags.name || way.tags['name:ka'] || null,
                        nameEn: way.tags['name:en'] || null,
                        housenumber: way.tags['addr:housenumber'] || null,
                        street: way.tags['addr:street'] || null,
                        buildingType: bType,
                        useType: 'residential',
                        roofShape: way.tags['roof:shape'] || 'flat',
                        height: parseFloat(height.toFixed(1)),
                        levels: levels,
                        coordinates: coords,
                        isProcedural: false
                      });
                    }
                  });
                  if (buildings.length > 0) break;
                }
              }
            } catch (_) {}
          }
        } catch (opErr) {
          console.warn('[Server] Overpass fallback note:', opErr.message);
        }
      }

      if (buildings.length > 0 && !res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'OK', source: 'osm', count: buildings.length, buildings: buildings }));
        return;
      }

      // Return empty array if no buildings found (open field/unmapped parcel)
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'OK', source: 'osm', count: 0, buildings: [] }));
      }
    })();
    return;
  }

  // Helper functions for Surroundings POI calculations
  function calcDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  function calcBearingDirection(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    brng = (brng + 360) % 360;
    const dirs = [
      { code: 'N', ka: 'ჩრდილოეთი', en: 'North' },
      { code: 'NE', ka: 'ჩრდ-აღმოსავლეთი', en: 'North-East' },
      { code: 'E', ka: 'აღმოსავლეთი', en: 'East' },
      { code: 'SE', ka: 'სამხრ-აღმოსავლეთი', en: 'South-East' },
      { code: 'S', ka: 'სამხრეთი', en: 'South' },
      { code: 'SW', ka: 'სამხრ-დასავლეთი', en: 'South-West' },
      { code: 'W', ka: 'დასავლეთი', en: 'West' },
      { code: 'NW', ka: 'ჩრდ-დასავლეთი', en: 'North-West' }
    ];
    const idx = Math.round(brng / 45) % 8;
    return dirs[idx];
  }

  const TBILISI_METRO_STATIONS = [
    { nameKa: 'მეტრო „ახმეტელის თეატრი“', nameEn: 'Akhmeteli Theatre Metro', lat: 41.7946, lng: 44.8192 },
    { nameKa: 'მეტრო „სარაჯიშვილი“', nameEn: 'Saradjishvili Metro', lat: 41.7858, lng: 44.8184 },
    { nameKa: 'მეტრო „გურამიშვილი“', nameEn: 'Guramishvili Metro', lat: 41.7761, lng: 44.8166 },
    { nameKa: 'მეტრო „ღრმაღელე“', nameEn: 'Ghrmaghele Metro', lat: 41.7656, lng: 44.8055 },
    { nameKa: 'მეტრო „დიდუბე“', nameEn: 'Didube Metro', lat: 41.7513, lng: 44.7801 },
    { nameKa: 'მეტრო „გოცირიძე“', nameEn: 'Gotsiridze Metro', lat: 41.7417, lng: 44.7876 },
    { nameKa: 'მეტრო „ნაძალადევი“', nameEn: 'Nadzaladevi Metro', lat: 41.7337, lng: 44.7997 },
    { nameKa: 'მეტრო „სადგურის მოედანი“', nameEn: 'Station Square Metro', lat: 41.7219, lng: 44.7994 },
    { nameKa: 'მეტრო „მარჯანიშვილი“', nameEn: 'Marjanishvili Metro', lat: 41.7099, lng: 44.7981 },
    { nameKa: 'მეტრო „რუსთაველი“', nameEn: 'Rustaveli Metro', lat: 41.7038, lng: 44.7915 },
    { nameKa: 'მეტრო „თავისუფლების მოედანი“', nameEn: 'Liberty Square Metro', lat: 41.6934, lng: 44.8016 },
    { nameKa: 'მეტრო „ავლაბარი“', nameEn: 'Avlabari Metro', lat: 41.6923, lng: 44.8159 },
    { nameKa: 'მეტრო „300 არაგველი“', nameEn: '300 Aragveli Metro', lat: 41.6874, lng: 44.8291 },
    { nameKa: 'მეტრო „ისანი“', nameEn: 'Isani Metro', lat: 41.6931, lng: 44.8436 },
    { nameKa: 'მეტრო „სამგორი“', nameEn: 'Samgori Metro', lat: 41.6953, lng: 44.8587 },
    { nameKa: 'მეტრო „ვარკეთილი“', nameEn: 'Varketili Metro', lat: 41.7011, lng: 44.8794 },
    { nameKa: 'მეტრო „წერეთელი“', nameEn: 'Tsereteli Metro', lat: 41.7262, lng: 44.7891 },
    { nameKa: 'მეტრო „ტექნიკური უნივერსიტეტი“', nameEn: 'Technical University Metro', lat: 41.7208, lng: 44.7788 },
    { nameKa: 'მეტრო „სამედიცინო უნივერსიტეტი“', nameEn: 'Medical University Metro', lat: 41.7279, lng: 44.7631 },
    { nameKa: 'მეტრო „დელისი“', nameEn: 'Delisi Metro', lat: 41.7247, lng: 44.7505 },
    { nameKa: 'მეტრო „ვაჟა-ფშაველა“', nameEn: 'Vazha-Pshavela Metro', lat: 41.7225, lng: 44.7397 },
    { nameKa: 'მეტრო „სახელმწიფო უნივერსიტეტი“', nameEn: 'State University Metro', lat: 41.7198, lng: 44.7268 }
  ];

  function generateProceduralPOIs(centerLat, centerLng) {
    const metersPerLat = 111139;
    const metersPerLng = 111139 * Math.cos(centerLat * Math.PI / 180);

    const isTbilisi = (centerLat >= 41.62 && centerLat <= 41.86 && centerLng >= 44.68 && centerLng <= 44.96);
    const poiItems = [];

    // If within Tbilisi region, calculate real nearest Metro station
    if (isTbilisi) {
      const sortedMetro = TBILISI_METRO_STATIONS.map(m => {
        const d = calcDistanceMeters(centerLat, centerLng, m.lat, m.lng);
        return { ...m, dist: d };
      }).sort((a, b) => a.dist - b.dist);

      const closestMetro = sortedMetro[0];
      if (closestMetro) {
        const bearing = calcBearingDirection(centerLat, centerLng, closestMetro.lat, closestMetro.lng);
        const encoded = encodeURIComponent(closestMetro.nameKa);
        poiItems.push({
          id: 'poi_metro_real',
          name: closestMetro.nameKa,
          nameKa: closestMetro.nameKa,
          nameEn: closestMetro.nameEn,
          category: 'metro',
          categoryNameKa: 'მეტროსადგური',
          categoryNameEn: 'Metro Station',
          icon: 'fa-train-subway',
          color: '#8b5cf6',
          lat: closestMetro.lat,
          lng: closestMetro.lng,
          distanceMeters: closestMetro.dist,
          walkTimeMin: Math.max(1, Math.round(closestMetro.dist / 70)),
          bearing: bearing.code,
          bearingKa: bearing.ka,
          bearingEn: bearing.en,
          googleMapsUrl: `https://www.google.com/maps/search/${encoded}/@${closestMetro.lat},${closestMetro.lng},17z`,
          yandexMapsUrl: `https://yandex.com/maps/?pt=${closestMetro.lng},${closestMetro.lat}&z=17&text=${encoded}`,
          googleMapsNavUrl: `https://www.google.com/maps/dir/?api=1&origin=${centerLat},${centerLng}&destination=${closestMetro.lat},${closestMetro.lng}&travelmode=walking`,
          yandexMapsNavUrl: `https://yandex.com/maps/?rtext=${centerLat},${centerLng}~${closestMetro.lat},${closestMetro.lng}&rtt=pd`,
          osmUrl: `https://www.openstreetmap.org/?mlat=${closestMetro.lat}&mlon=${closestMetro.lng}&zoom=17`,
          isProcedural: false
        });
      }
    }

    return poiItems.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  function classifyOsmPoi(tags) {
    let cat = null;
    let catKa = 'მომსახურება';
    let icon = 'fa-location-dot';
    let color = '#38bdf8';

    if (tags.amenity === 'school' || tags.amenity === 'college' || tags.amenity === 'university') {
      cat = 'education'; catKa = 'სკოლა / უნივერსიტეტი'; icon = 'fa-graduation-cap'; color = '#38bdf8';
    } else if (tags.amenity === 'kindergarten') {
      cat = 'kindergarten'; catKa = 'საბავშვო ბაღი'; icon = 'fa-child-reaching'; color = '#ec4899';
    } else if (tags.station === 'subway' || (tags.railway === 'station' && (tags['station'] === 'subway' || tags.network)) || tags.railway === 'subway_entrance') {
      cat = 'metro'; catKa = 'მეტროსადგური'; icon = 'fa-train-subway'; color = '#8b5cf6';
    } else if (tags.railway === 'station' || tags.railway === 'halt') {
      cat = 'train'; catKa = 'სარკინიგზო სადგური'; icon = 'fa-train'; color = '#6366f1';
    } else if (tags.railway === 'tram_stop') {
      cat = 'tram'; catKa = 'ტრამვაის გაჩერება'; icon = 'fa-train-tram'; color = '#f59e0b';
    } else if (tags.shop === 'supermarket' || tags.shop === 'convenience' || tags.amenity === 'supermarket' || tags.shop === 'mall') {
      cat = 'supermarket'; catKa = 'სუპერმარკეტი'; icon = 'fa-basket-shopping'; color = '#10b981';
    } else if (tags.amenity === 'pharmacy') {
      cat = 'pharmacy'; catKa = 'აფთიაქი'; icon = 'fa-pills'; color = '#f43f5e';
    } else if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'doctors') {
      cat = 'hospital'; catKa = 'საავადმყოფო / კლინიკა'; icon = 'fa-hospital'; color = '#ef4444';
    } else if (tags.highway === 'bus_stop' || tags.amenity === 'bus_station' || (tags.public_transport === 'stop_position' && tags.bus === 'yes') || tags.public_transport === 'platform') {
      cat = 'transport'; catKa = 'ავტობუსის გაჩერება'; icon = 'fa-bus'; color = '#f59e0b';
    } else if (tags.amenity === 'taxi') {
      cat = 'taxi'; catKa = 'ტაქსი'; icon = 'fa-taxi'; color = '#eab308';
    } else if (tags.leisure === 'park' || tags.leisure === 'garden') {
      cat = 'park'; catKa = 'სკვერი / პარკი'; icon = 'fa-tree'; color = '#22c55e';
    } else if (tags.leisure === 'playground') {
      cat = 'playground'; catKa = 'სათამაშო მოედანი'; icon = 'fa-children'; color = '#84cc16';
    } else if (tags.leisure === 'pitch' || tags.leisure === 'sports_centre' || tags.leisure === 'fitness_centre') {
      cat = 'sport'; catKa = 'სპორტული ობიექტი'; icon = 'fa-futbol'; color = '#06b6d4';
    } else if (tags.leisure === 'swimming_pool') {
      cat = 'pool'; catKa = 'აუზი'; icon = 'fa-person-swimming'; color = '#0ea5e9';
    } else if (tags.amenity === 'bank' || tags.amenity === 'atm') {
      cat = 'bank'; catKa = 'ბანკი / ბანკომატი'; icon = 'fa-building-columns'; color = '#0284c7';
    } else if (tags.amenity === 'fuel') {
      cat = 'fuel'; catKa = 'ბენზინგასამართი'; icon = 'fa-gas-pump'; color = '#94a3b8';
    } else if (tags.amenity === 'library') {
      cat = 'library'; catKa = 'ბიბლიოთეკა'; icon = 'fa-book'; color = '#a78bfa';
    } else if (tags.amenity === 'cinema' || tags.amenity === 'theatre') {
      cat = 'entertainment'; catKa = 'გართობა / კულტურა'; icon = 'fa-masks-theater'; color = '#fb923c';
    } else if (tags.amenity === 'cafe' || tags.amenity === 'restaurant' || tags.amenity === 'fast_food') {
      cat = 'restaurant'; catKa = 'კაფე / რესტორანი'; icon = 'fa-utensils'; color = '#f97316';
    } else if (tags.amenity === 'police') {
      cat = 'police'; catKa = 'პოლიცია'; icon = 'fa-shield-halved'; color = '#1d4ed8';
    } else if (tags.amenity === 'post_office') {
      cat = 'post'; catKa = 'ფოსტა'; icon = 'fa-envelope'; color = '#7c3aed';
    } else if (tags.amenity || tags.shop) {
      cat = 'amenity'; catKa = 'მომსახურება'; icon = 'fa-location-dot'; color = '#38bdf8';
    }

    if (!cat) return null;
    return { cat, catKa, icon, color };
  }

  function parseOsmXmlToPois(xml, centerLat, centerLng, maxRadius) {
    const pois = [];
    const nodeMap = new Map();

    const nodeRegex = /<node\s+([^>]+?)(?:\/>|>(.*?)<\/node>)/gs;
    let match;
    while ((match = nodeRegex.exec(xml)) !== null) {
      const attrs = match[1];
      const inner = match[2];
      const idM = attrs.match(/id="(\d+)"/);
      const latM = attrs.match(/lat="([0-9.-]+)"/);
      const lonM = attrs.match(/lon="([0-9.-]+)"/);
      if (!idM || !latM || !lonM) continue;

      const nId = idM[1];
      const nLat = parseFloat(latM[1]);
      const nLon = parseFloat(lonM[1]);
      nodeMap.set(nId, { lat: nLat, lon: nLon });

      if (inner && inner.includes('<tag')) {
        const tags = {};
        const tagRegex = /<tag\s+k="([^"]+)"\s+v="([^"]*)"/g;
        let t;
        while ((t = tagRegex.exec(inner)) !== null) {
          tags[t[1]] = t[2];
        }

        const classified = classifyOsmPoi(tags);
        if (classified) {
          const dist = calcDistanceMeters(centerLat, centerLng, nLat, nLon);
          if (dist <= maxRadius) {
            const bearing = calcBearingDirection(centerLat, centerLng, nLat, nLon);
            const name = tags.name || tags['name:ka'] || tags['name:en'] || `${classified.catKa} (${dist} მ)`;
            const poiLat = Number(nLat.toFixed(6));
            const poiLng = Number(nLon.toFixed(6));
            const encodedName = encodeURIComponent(name);

            pois.push({
              id: `osm_node_${nId}`,
              name,
              nameKa: name,
              nameEn: tags['name:en'] || name,
              category: classified.cat,
              categoryNameKa: classified.catKa,
              categoryNameEn: classified.cat,
              icon: classified.icon,
              color: classified.color,
              lat: poiLat,
              lng: poiLng,
              distanceMeters: dist,
              walkTimeMin: Math.max(1, Math.round(dist / 70)),
              bearing: bearing.code,
              bearingKa: bearing.ka,
              bearingEn: bearing.en,
              googleMapsUrl: `https://www.google.com/maps/search/${encodedName}/@${poiLat},${poiLng},17z`,
              yandexMapsUrl: `https://yandex.com/maps/?pt=${poiLng},${poiLat}&z=17&text=${encodedName}`,
              googleMapsNavUrl: `https://www.google.com/maps/dir/?api=1&origin=${centerLat},${centerLng}&destination=${poiLat},${poiLng}&travelmode=walking`,
              yandexMapsNavUrl: `https://yandex.com/maps/?rtext=${centerLat},${centerLng}~${poiLat},${poiLng}&rtt=pd`,
              osmUrl: `https://www.openstreetmap.org/?mlat=${poiLat}&mlon=${poiLng}&zoom=17`,
              isProcedural: false
            });
          }
        }
      }
    }

    const wayRegex = /<way\s+id="(\d+)"[^>]*>(.*?)<\/way>/gs;
    while ((match = wayRegex.exec(xml)) !== null) {
      const wayId = match[1];
      const inner = match[2];
      if (!inner.includes('<tag')) continue;

      const tags = {};
      const tagRegex = /<tag\s+k="([^"]+)"\s+v="([^"]*)"/g;
      let t;
      while ((t = tagRegex.exec(inner)) !== null) {
        tags[t[1]] = t[2];
      }

      const classified = classifyOsmPoi(tags);
      if (!classified) continue;

      const ndRegex = /<nd\s+ref="(\d+)"/g;
      let ndMatch;
      let sumLat = 0, sumLon = 0, count = 0;
      while ((ndMatch = ndRegex.exec(inner)) !== null) {
        const nodePos = nodeMap.get(ndMatch[1]);
        if (nodePos) {
          sumLat += nodePos.lat;
          sumLon += nodePos.lon;
          count++;
        }
      }
      if (count === 0) continue;

      const cLat = sumLat / count;
      const cLon = sumLon / count;
      const dist = calcDistanceMeters(centerLat, centerLng, cLat, cLon);
      if (dist <= maxRadius) {
        const bearing = calcBearingDirection(centerLat, centerLng, cLat, cLon);
        const name = tags.name || tags['name:ka'] || tags['name:en'] || `${classified.catKa} (${dist} მ)`;
        const poiLat = Number(cLat.toFixed(6));
        const poiLng = Number(cLon.toFixed(6));
        const encodedName = encodeURIComponent(name);

        pois.push({
          id: `osm_way_${wayId}`,
          name,
          nameKa: name,
          nameEn: tags['name:en'] || name,
          category: classified.cat,
          categoryNameKa: classified.catKa,
          categoryNameEn: classified.cat,
          icon: classified.icon,
          color: classified.color,
          lat: poiLat,
          lng: poiLng,
          distanceMeters: dist,
          walkTimeMin: Math.max(1, Math.round(dist / 70)),
          bearing: bearing.code,
          bearingKa: bearing.ka,
          bearingEn: bearing.en,
          googleMapsUrl: `https://www.google.com/maps/search/${encodedName}/@${poiLat},${poiLng},17z`,
          yandexMapsUrl: `https://yandex.com/maps/?pt=${poiLng},${poiLat}&z=17&text=${encodedName}`,
          googleMapsNavUrl: `https://www.google.com/maps/dir/?api=1&origin=${centerLat},${centerLng}&destination=${poiLat},${poiLng}&travelmode=walking`,
          yandexMapsNavUrl: `https://yandex.com/maps/?rtext=${centerLat},${centerLng}~${poiLat},${poiLng}&rtt=pd`,
          osmUrl: `https://www.openstreetmap.org/?mlat=${poiLat}&mlon=${poiLng}&zoom=17`,
          isProcedural: false
        });
      }
    }

    return pois;
  }

  function balanceAndFilterPois(rawPois, maxTotal = 200) {
    const seen = new Set();
    const deduped = [];
    for (const p of rawPois) {
      const key = `${p.category}_${p.name}_${Math.round(p.lat * 4000)}_${Math.round(p.lng * 4000)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(p);
      }
    }

    deduped.sort((a, b) => a.distanceMeters - b.distanceMeters);

    const guaranteed = [];
    const others = [];
    const catCount = {};

    for (const p of deduped) {
      catCount[p.category] = (catCount[p.category] || 0) + 1;
      if (p.category === 'amenity' && catCount[p.category] > 40) continue;
      if (p.category === 'supermarket' && catCount[p.category] > 25) continue;
      if (p.category === 'transport' && catCount[p.category] > 20) continue;
      if (p.category === 'bank' && catCount[p.category] > 15) continue;
      if (p.category === 'restaurant' && catCount[p.category] > 20) continue;

      if (['metro', 'education', 'kindergarten', 'hospital', 'park'].includes(p.category)) {
        guaranteed.push(p);
      } else {
        others.push(p);
      }
    }

    const combined = [...guaranteed, ...others];
    combined.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return combined.slice(0, maxTotal);
  }

  // 1B-2. Surroundings & Nearby Amenities (POIs) API (Schools, Kindergartens, Supermarkets, Pharmacies, Parks, Transport, Metro)
  if (parsedUrl.pathname === '/api/surroundings-poi') {
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
    const searchRadius = Math.min(2000, Math.max(200, parseInt(parsedUrl.searchParams.get('radius') || '1000', 10)));
    const forceRefresh = parsedUrl.searchParams.has('refresh');

    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${searchRadius}`;
    if (!forceRefresh && surroundingsPoiCache.has(cacheKey)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(surroundingsPoiCache.get(cacheKey)));
      return;
    }

    (async () => {
      let rawPois = [];

      // Tier 1: Fetch via official OpenStreetMap API 0.6 bbox query (fast ~1.5s, reliable, unblocked)
      try {
        const dLat = searchRadius / 111132.954;
        const dLng = searchRadius / (111132.954 * Math.cos(lat * Math.PI / 180));
        const bbox = `${(lng - dLng).toFixed(6)},${(lat - dLat).toFixed(6)},${(lng + dLng).toFixed(6)},${(lat + dLat).toFixed(6)}`;

        const osmRes = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, {
          headers: {
            'User-Agent': 'BIMXGeorgiaConTech/2.1 (https://architect2.ge; info@bimx.ge)',
            'Accept': 'application/xml, text/xml'
          },
          signal: AbortSignal.timeout(7000)
        });

        if (osmRes.ok) {
          const xml = await osmRes.text();
          if (xml && xml.includes('<node')) {
            rawPois = parseOsmXmlToPois(xml, lat, lng, searchRadius);
          }
        }
      } catch (osmErr) {
        console.warn('[Server] OSM API 0.6 POI fetch note:', osmErr.message);
      }

      // Tier 2: Overpass API query fallback if OSM API returned empty
      if (rawPois.length === 0) {
        try {
          const overpassQuery = `[out:json][timeout:10];(
            node["amenity"~"school|kindergarten|pharmacy|hospital|clinic|supermarket|cafe|restaurant|bank|fuel|atm|library|cinema|theatre|police|post_office|fire_station"](around:${searchRadius},${lat},${lng});
            node["shop"~"supermarket|convenience|mall|bakery|butcher|clothes|electronics"](around:${searchRadius},${lat},${lng});
            node["leisure"~"park|garden|playground|pitch|sports_centre|swimming_pool|fitness_centre"](around:${searchRadius},${lat},${lng});
            node["highway"="bus_stop"](around:${searchRadius},${lat},${lng});
            node["public_transport"="stop_position"](around:${searchRadius},${lat},${lng});
            node["railway"~"station|subway_entrance|tram_stop"](around:${searchRadius},${lat},${lng});
            node["station"="subway"](around:${searchRadius},${lat},${lng});
            node["amenity"="bus_station"](around:${searchRadius},${lat},${lng});
            node["amenity"="taxi"](around:${searchRadius},${lat},${lng});
            way["amenity"~"school|kindergarten|hospital|university"](around:${searchRadius},${lat},${lng});
            way["leisure"~"park|garden|playground"](around:${searchRadius},${lat},${lng});
          );out center 150;`;

          const postPoiBody = `data=${encodeURIComponent(overpassQuery)}`;
          const mirrors = [
            'https://lz4.overpass-api.de/api/interpreter',
            'https://overpass-api.de/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
          ];

          const fetchPoiMirror = async (mirror) => {
            const res = await fetch(mirror, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'BIMXGeorgiaConTech/2.1 (https://architect2.ge; info@bimx.ge)',
                'Referer': 'https://architect2.ge/parcel-ai'
              },
              body: postPoiBody,
              signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
          };

          const result = await Promise.any(mirrors.map(m => fetchPoiMirror(m)));
          if (result && Array.isArray(result.elements)) {
            result.elements.forEach(elem => {
              const tags = elem.tags || {};
              const pLat = elem.lat || (elem.center && elem.center.lat);
              const pLng = elem.lon || (elem.center && elem.center.lon);
              if (!pLat || !pLng) return;

              const classified = classifyOsmPoi(tags);
              if (!classified) return;

              const dist = calcDistanceMeters(lat, lng, pLat, pLng);
              if (dist > searchRadius) return;
              const bearing = calcBearingDirection(lat, lng, pLat, pLng);
              const name = tags.name || tags['name:ka'] || tags['name:en'] || `${classified.catKa} (${dist} მ)`;

              const poiLat = Number(pLat.toFixed(6));
              const poiLng = Number(pLng.toFixed(6));
              const encodedName = encodeURIComponent(name);
              rawPois.push({
                id: `osm_${elem.id}`,
                name: name,
                nameKa: name,
                nameEn: tags['name:en'] || name,
                category: classified.cat,
                categoryNameKa: classified.catKa,
                categoryNameEn: classified.cat,
                icon: classified.icon,
                color: classified.color,
                lat: poiLat,
                lng: poiLng,
                distanceMeters: dist,
                walkTimeMin: Math.max(1, Math.round(dist / 70)),
                bearing: bearing.code,
                bearingKa: bearing.ka,
                bearingEn: bearing.en,
                googleMapsUrl: `https://www.google.com/maps/search/${encodedName}/@${poiLat},${poiLng},17z`,
                yandexMapsUrl: `https://yandex.com/maps/?pt=${poiLng},${poiLat}&z=17&text=${encodedName}`,
                googleMapsNavUrl: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${poiLat},${poiLng}&travelmode=walking`,
                yandexMapsNavUrl: `https://yandex.com/maps/?rtext=${lat},${lng}~${poiLat},${poiLng}&rtt=pd`,
                osmUrl: `https://www.openstreetmap.org/?mlat=${poiLat}&mlon=${poiLng}&zoom=17`,
                isProcedural: false
              });
            });
          }
        } catch (opErr) {
          console.warn('[Server] Overpass POI mirror fetch note:', opErr.message);
        }
      }

      // Tier 3: In Tbilisi, ensure real nearest metro anchor is present
      const isTbilisi = (lat >= 41.62 && lat <= 41.86 && lng >= 44.68 && lng <= 44.96);
      if (isTbilisi && !rawPois.some(p => p.category === 'metro')) {
        const sortedMetro = TBILISI_METRO_STATIONS.map(m => {
          const d = calcDistanceMeters(lat, lng, m.lat, m.lng);
          return { ...m, dist: d };
        }).sort((a, b) => a.dist - b.dist);

        const closestMetro = sortedMetro[0];
        if (closestMetro && closestMetro.dist <= 3000) {
          const bearing = calcBearingDirection(lat, lng, closestMetro.lat, closestMetro.lng);
          const encoded = encodeURIComponent(closestMetro.nameKa);
          rawPois.push({
            id: 'poi_metro_real',
            name: closestMetro.nameKa,
            nameKa: closestMetro.nameKa,
            nameEn: closestMetro.nameEn,
            category: 'metro',
            categoryNameKa: 'მეტროსადგური',
            categoryNameEn: 'Metro Station',
            icon: 'fa-train-subway',
            color: '#8b5cf6',
            lat: closestMetro.lat,
            lng: closestMetro.lng,
            distanceMeters: closestMetro.dist,
            walkTimeMin: Math.max(1, Math.round(closestMetro.dist / 70)),
            bearing: bearing.code,
            bearingKa: bearing.ka,
            bearingEn: bearing.en,
            googleMapsUrl: `https://www.google.com/maps/search/${encoded}/@${closestMetro.lat},${closestMetro.lng},17z`,
            yandexMapsUrl: `https://yandex.com/maps/?pt=${closestMetro.lng},${closestMetro.lat}&z=17&text=${encoded}`,
            googleMapsNavUrl: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${closestMetro.lat},${closestMetro.lng}&travelmode=walking`,
            yandexMapsNavUrl: `https://yandex.com/maps/?rtext=${lat},${lng}~${closestMetro.lat},${closestMetro.lng}&rtt=pd`,
            osmUrl: `https://www.openstreetmap.org/?mlat=${closestMetro.lat}&mlon=${closestMetro.lng}&zoom=17`,
            isProcedural: false
          });
        }
      }

      const finalPois = balanceAndFilterPois(rawPois, 200);

      const within300m = finalPois.filter(p => p.distanceMeters <= 300).length;
      const within500m = finalPois.filter(p => p.distanceMeters <= 500).length;
      const within1000m = finalPois.filter(p => p.distanceMeters <= 1000).length;

      const byCategory = {};
      finalPois.forEach(p => {
        byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      });

      const responsePayload = {
        status: 'OK',
        center: { lat, lng },
        radius: searchRadius,
        summary: {
          total: finalPois.length,
          within300m,
          within500m,
          within1000m,
          byCategory
        },
        pois: finalPois
      };

      if (finalPois.length > 0) {
        surroundingsPoiCache.set(cacheKey, responsePayload);
      }

      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(responsePayload));
      }
    })();
    return;
  }

  // 1C. DEM / Elevation & Topography Slope API
  // 1C. High-Precision Copernicus DEM 90m Elevation & 3D Topographic Mesh API (Open-Meteo)
  const elevationCache = new Map();

  if (parsedUrl.pathname === '/api/elevation') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const lat = parseFloat(parsedUrl.searchParams.get('lat') || '41.7151');
    const lng = parseFloat(parsedUrl.searchParams.get('lng') || '44.8271');
    const isGrid = parsedUrl.searchParams.get('grid') === 'true';
    const radiusMeters = Math.min(600, Math.max(80, parseFloat(parsedUrl.searchParams.get('radius') || '200')));
    const gridSize = 7; // 7x7 = 49 elevation samples across terrain area

    // Regional fallback elevation model across Georgia if offline
    function getRegionalFallbackElevation(la, lo) {
      if (lo < 42.0) return Math.round(15 + Math.sin(la * 100) * 10); // Black Sea / Coastal
      if (la > 42.5 && lo > 44.4) return 1740; // Kazbegi / High Caucasus
      if (la > 42.8 && lo < 43.0) return 1520; // Svaneti / Mestia
      if (lo > 44.6 && lo < 45.1 && la > 41.6 && la < 41.9) return 480; // Tbilisi Basin
      if (lo > 42.5 && lo < 43.0 && la > 42.1 && la < 42.4) return 150; // Imereti / Kutaisi
      if (lo > 44.8 && lo < 45.2 && la > 41.4 && la < 41.7) return 370; // Kvemo Kartli / Rustavi
      if (lo > 45.3 && la > 41.5 && la < 42.1) return 550; // Kakheti
      return 520;
    }

    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${isGrid ? radiusMeters : 'single'}`;
    if (elevationCache.has(cacheKey)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(elevationCache.get(cacheKey)));
      return;
    }

    (async () => {
      try {
        if (!isGrid) {
          // Single-point elevation query
          const apiUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}`;
          const elevRes = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
          if (elevRes.ok) {
            const elevData = await elevRes.json();
            const el = Array.isArray(elevData.elevation) ? elevData.elevation[0] : elevData.elevation;
            if (typeof el === 'number') {
              const result = { status: 'OK', elevation: Math.round(el * 10) / 10, source: 'copernicus-dem-90m' };
              elevationCache.set(cacheKey, result);
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify(result));
              return;
            }
          }
        } else {
          // 7x7 Grid elevation query for real 3D topographic relief mesh
          const dLatDeg = radiusMeters / 111132;
          const dLngDeg = radiusMeters / (111132 * Math.cos(lat * Math.PI / 180));
          const stepLat = (dLatDeg * 2) / (gridSize - 1);
          const stepLng = (dLngDeg * 2) / (gridSize - 1);

          const lats = [];
          const lngs = [];
          for (let r = 0; r < gridSize; r++) {
            const curLat = (lat + dLatDeg - r * stepLat).toFixed(6);
            for (let c = 0; c < gridSize; c++) {
              const curLng = (lng - dLngDeg + c * stepLng).toFixed(6);
              lats.push(curLat);
              lngs.push(curLng);
            }
          }

          const apiUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`;
          const elevRes = await fetch(apiUrl, { signal: AbortSignal.timeout(4500) });
          if (elevRes.ok) {
            const elevData = await elevRes.json();
            if (Array.isArray(elevData.elevation) && elevData.elevation.length === (gridSize * gridSize)) {
              const elevs = elevData.elevation;
              const centerIdx = Math.floor((gridSize * gridSize) / 2);
              const centerElevation = elevs[centerIdx];
              const minElevation = Math.min(...elevs);
              const maxElevation = Math.max(...elevs);
              const deltaZ = Math.round((maxElevation - minElevation) * 10) / 10;
              const slopePct = Math.round(((deltaZ / (radiusMeters * 1.5)) * 100) * 10) / 10;

              const result = {
                status: 'OK',
                elevation: Math.round(centerElevation * 10) / 10,
                centerLat: lat,
                centerLng: lng,
                gridSize,
                radiusMeters,
                grid: elevs,
                minElevation,
                maxElevation,
                deltaZ,
                slopePct,
                source: 'copernicus-dem-90m'
              };
              elevationCache.set(cacheKey, result);
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify(result));
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[Server] Open-Meteo elevation API note:', err.message);
      }

      // Fallback response if external DEM is temporarily unreachable
      const baseEst = getRegionalFallbackElevation(lat, lng);
      const fallbackResult = isGrid ? {
        status: 'OK',
        elevation: baseEst,
        centerLat: lat,
        centerLng: lng,
        gridSize,
        radiusMeters,
        grid: new Array(gridSize * gridSize).fill(baseEst),
        minElevation: baseEst,
        maxElevation: baseEst + 2.0,
        deltaZ: 2.0,
        slopePct: 2.5,
        source: 'regional_fallback'
      } : {
        status: 'OK',
        elevation: baseEst,
        source: 'regional_fallback'
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(fallbackResult));
    })();
    return;
  }

  // 1E. TAS.GE Municipal Defect & Precedent Intelligence Engine (500m radius analysis)
  if (parsedUrl.pathname === '/api/tas-precedents') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const handlePrecedents = async (lat, lng, code, concept) => {
      try {
        const result = await tasPrecedentsEngine.getPrecedentsAroundParcel(lat, lng, code, concept);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
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
          handlePrecedents(payload.lat, payload.lng, payload.code, payload.concept || {});
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    } else {
      const lat = parseFloat(parsedUrl.searchParams.get('lat') || '41.715');
      const lng = parseFloat(parsedUrl.searchParams.get('lng') || '44.785');
      const code = parsedUrl.searchParams.get('code') || '';
      const floors = parseInt(parsedUrl.searchParams.get('floors') || '5', 10);
      const heightM = parseFloat(parsedUrl.searchParams.get('height') || '16.5');
      handlePrecedents(lat, lng, code, { floors, heightM });
      return;
    }
  }

  // 1F. Slope-Aware Road, Fire Access & Circulation Network Generator
  if (parsedUrl.pathname === '/api/circulation-network') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const handleCirculation = (options) => {
      try {
        const result = circulationEngine.generateCirculationNetwork(options);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
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
          handleCirculation(payload);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    } else {
      const roadWidthM = parseFloat(parsedUrl.searchParams.get('roadWidth') || '4.5');
      const maxAllowedGradePct = parseFloat(parsedUrl.searchParams.get('maxGrade') || '8.0');
      const terrainSlopePct = parseFloat(parsedUrl.searchParams.get('slope') || '5.5');
      const turnaroundType = parsedUrl.searchParams.get('turnaround') || 'LOOP';
      handleCirculation({ roadWidthM, maxAllowedGradePct, terrainSlopePct, turnaroundType });
      return;
    }
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
