/**
 * lib/napr-client.ts
 * -----------------------------------------------------------------------
 * რეალური NAPR (maps.gov.ge — საჯარო რეესტრის ეროვნული სააგენტო)
 * კლიენტი ნაკვეთის ატრიბუტებისა და გეომეტრიის პროგრამულად წასაკითხად.
 *
 * დადგენილი რეალური endpoint-ები:
 * 1. Search: POST https://maps.gov.ge/map/portal/search
 *    Body: keyword=<cadastralCode>&keyword_description=
 *    Response: { status: true, result: [ { id, name, descript, details: { geometry_link } } ] }
 *
 * 2. Geometry: GET https://maps.gov.ge/lr/bo/mg/getinfo.alpha?lbl=<lbl>&res=shp
 *    Response: { provider: "immovable", data: [ { id, name, proj: "EPSG:4326", shape: "POLYGON ((...))", shape_format: "WKT" } ] }
 */

export interface ParcelData {
  cadastralCode: string;
  /** GeoJSON-ის მსგავსი polygon კოორდინატები [lng, lat][] */
  boundary: [number, number][];
  areaSqm: number;
  address: string;
  shapeWkt?: string;
  /** ნედლი პასუხი debugging-ისთვის */
  raw?: unknown;
}

const NAPR_SEARCH_URL = "https://maps.gov.ge/map/portal/search";
const NAPR_BASE_URL = "https://maps.gov.ge";

/**
 * WKT POLYGON ((lng lat, lng lat, ...)) ტექსტის გარდაქმნა [lng, lat][] მასივად
 */
export function parseWktPolygon(wkt: string): [number, number][] {
  const match = wkt.match(/\(\((.+)\)\)/);
  if (!match) return [];
  return match[1].split(",").map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return [lng, lat] as [number, number];
  });
}

/**
 * პოლიგონის ფართობის გამოთვლა კვადრატულ მეტრებში (Shoelace ალგორითმი)
 */
export function calculatePolygonAreaSqm(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  let area = 0;
  const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
  const metersPerDegLat = 111132.954;
  const metersPerDegLng = 111132.954 * Math.cos((avgLat * Math.PI) / 180);

  for (let i = 0; i < coords.length - 1; i++) {
    const x1 = coords[i][0] * metersPerDegLng;
    const y1 = coords[i][1] * metersPerDegLat;
    const x2 = coords[i + 1][0] * metersPerDegLng;
    const y2 = coords[i + 1][1] * metersPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(Math.round(area / 2));
}

/**
 * საკადასტრო კოდით ნაკვეთის მონაცემების ამოღება maps.gov.ge-დან
 */
export async function fetchParcelByCadastralCode(
  cadastralCode: string
): Promise<ParcelData> {
  const normalizedCode = cadastralCode.trim().replace(/\s+/g, "");

  // 1. ძებნა
  const searchRes = await fetch(NAPR_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://maps.gov.ge/map/portal/",
      "Origin": "https://maps.gov.ge",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ keyword: normalizedCode, keyword_description: "" }),
  });

  if (!searchRes.ok) {
    throw new Error(`NAPR search failed with status: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  if (!searchData.status || !searchData.result || searchData.result.length === 0) {
    throw new Error(`ნაკვეთი საკადასტრო კოდით ${normalizedCode} ვერ მოიძებნა`);
  }

  const item = searchData.result[0];
  const address = item.descript || item.resulttext || "";
  const geomLink = item.details?.geometry_link;

  if (!geomLink) {
    return {
      cadastralCode: normalizedCode,
      address,
      boundary: [],
      areaSqm: 0,
      raw: item,
    };
  }

  // 2. გეომეტრიის ამოღება
  const geomUrl = geomLink.startsWith("http") ? geomLink : `${NAPR_BASE_URL}${geomLink}`;
  const geomRes = await fetch(geomUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://maps.gov.ge/map/portal/",
      "Origin": "https://maps.gov.ge",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!geomRes.ok) {
    throw new Error(`NAPR geometry fetch failed: ${geomRes.status}`);
  }

  const geomData = await geomRes.json();
  const shapeWkt: string = geomData.data?.[0]?.shape || "";
  const boundary = shapeWkt ? parseWktPolygon(shapeWkt) : [];
  const areaSqm = calculatePolygonAreaSqm(boundary);

  return {
    cadastralCode: normalizedCode,
    address,
    areaSqm,
    boundary,
    shapeWkt,
    raw: { search: item, geometry: geomData },
  };
}
