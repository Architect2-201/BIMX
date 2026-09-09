import { NextRequest, NextResponse } from "next/server";

/**
 * app/api/parcel/route.ts
 * -----------------------------------------------------------------------
 * Stateless proxy — რეალურ NAPR (maps.gov.ge) endpoint-ებთან კავშირი
 *
 * მკაცრი წესი: ეს route არაფერს ინახავს (არც ლოგებში, არც ბაზაში, არც დისკზე) —
 * უბრალოდ გადასცემს მოთხოვნას maps.gov.ge-ზე და აბრუნებს პასუხს.
 */

const CADASTRAL_CODE_REGEX = /^\d{2}[.\-]\d{2}[.\-]\d{2}[.\-]\d{2,3}[.\-]\d{2,3}$/;

function parseWktPolygon(wkt: string): [number, number][] {
  const match = wkt.match(/\(\((.+)\)\)/);
  if (!match) return [];
  return match[1].split(",").map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return [lng, lat] as [number, number];
  });
}

function calculatePolygonAreaSqm(coords: [number, number][]): number {
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

export async function GET(req: NextRequest) {
  const cadastralCode = req.nextUrl.searchParams.get("code");

  if (!cadastralCode) {
    return NextResponse.json(
      { error: "cadastral code (code) query param აუცილებელია" },
      { status: 400 }
    );
  }

  const normalizedCode = cadastralCode.trim().replace(/\s+/g, "");
  if (!CADASTRAL_CODE_REGEX.test(normalizedCode)) {
    return NextResponse.json(
      { error: "საკადასტრო კოდის ფორმატი არასწორია (მაგ.: 01.10.09.001.001)" },
      { status: 400 }
    );
  }

  try {
    // 1. NAPR Search
    const searchRes = await fetch("https://maps.gov.ge/map/portal/search", {
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
      return NextResponse.json(
        { error: `NAPR search failed with status: ${searchRes.status}` },
        { status: 502 }
      );
    }

    const searchData = await searchRes.json();
    if (!searchData.status || !searchData.result || searchData.result.length === 0) {
      return NextResponse.json(
        { error: "ნაკვეთი მითითებული საკადასტრო კოდით ვერ მოიძებნა" },
        { status: 404 }
      );
    }

    const item = searchData.result[0];
    const address = item.descript || item.resulttext || "";
    const geomLink = item.details?.geometry_link;

    if (!geomLink) {
      return NextResponse.json({
        cadastralCode: normalizedCode,
        address,
        areaSqm: 0,
        boundary: [],
        status: true,
      });
    }

    // 2. NAPR Geometry
    const geomUrl = geomLink.startsWith("http") ? geomLink : `https://maps.gov.ge${geomLink}`;
    const geomRes = await fetch(geomUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://maps.gov.ge/map/portal/",
        "Origin": "https://maps.gov.ge",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!geomRes.ok) {
      return NextResponse.json(
        { error: "NAPR geometry request failed" },
        { status: 502 }
      );
    }

    const geomData = await geomRes.json();
    const shapeWkt: string = geomData.data?.[0]?.shape || "";
    const boundary = shapeWkt ? parseWktPolygon(shapeWkt) : [];
    const areaSqm = calculatePolygonAreaSqm(boundary);

    // პასუხის დაბრუნება (კოდი მეხსიერებიდანვე იშლება, არანაირი შენახვა)
    return NextResponse.json({
      status: true,
      cadastralCode: normalizedCode,
      address,
      areaSqm,
      boundary,
      shapeWkt,
      source: "maps.gov.ge (NAPR)",
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unknown error during NAPR fetch" },
      { status: 500 }
    );
  }
}
