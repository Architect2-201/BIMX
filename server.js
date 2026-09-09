const http = require('http');
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

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);

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

    const normalizedCode = cadastralCode.trim().replace(/\s+/g, '');
    const CADASTRAL_CODE_REGEX = /^\d{2}[.\-]\d{2}[.\-]\d{2}[.\-]\d{2,3}[.\-]\d{2,3}$/;
    if (!CADASTRAL_CODE_REGEX.test(normalizedCode)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: "საკადასტრო კოდის ფორმატი არასწორია (მაგ.: 01.10.09.001.001)" }));
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

    // Live NAPR fetch without storing code to disk/database
    (async () => {
      try {
        const searchRes = await fetch("https://maps.gov.ge/map/portal/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://maps.gov.ge/map/portal/",
            "Origin": "https://maps.gov.ge",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: new URLSearchParams({ keyword: normalizedCode, keyword_description: "" })
        });

        if (!searchRes.ok) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: `NAPR search failed: ${searchRes.status}` }));
          return;
        }

        const searchData = await searchRes.json();
        if (!searchData.status || !searchData.result || searchData.result.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            status: false,
            error: "ნაკვეთი მითითებული საკადასტრო კოდით ვერ მოიძებნა",
            code: normalizedCode,
            portalUrl: "https://maps.gov.ge/map/portal"
          }));
          return;
        }

        const item = searchData.result[0];
        const address = item.descript || item.resulttext || "";
        const geomLink = item.details && item.details.geometry_link;

        let boundary = [];
        let shapeWkt = "";
        let areaSqm = 0;

        if (geomLink) {
          const geomUrl = geomLink.startsWith("http") ? geomLink : `https://maps.gov.ge${geomLink}`;
          const geomRes = await fetch(geomUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": "https://maps.gov.ge/map/portal/",
              "Origin": "https://maps.gov.ge",
              "X-Requested-With": "XMLHttpRequest",
            }
          });

          if (geomRes.ok) {
            const geomData = await geomRes.json();
            shapeWkt = (geomData.data && geomData.data[0] && geomData.data[0].shape) || "";
            if (shapeWkt) {
              boundary = parseWktPolygonToLatLng(shapeWkt);
              areaSqm = calculateAreaSqm(boundary);
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: true,
          cadastralCode: normalizedCode,
          address: address,
          areaSqm: areaSqm,
          coordinates: boundary, // [lat, lng] array
          shapeWkt: shapeWkt,
          source: "maps.gov.ge (NAPR Live)",
          portalUrl: "https://maps.gov.ge/map/portal"
        }));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          error: "NAPR service connection error: " + (err.message || err),
          code: normalizedCode,
          portalUrl: "https://maps.gov.ge/map/portal"
        }));
      }
    })();
    return;
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
});

server.listen(PORT, () => {
  console.log(`BIMX server running at http://localhost:${PORT}`);
});
