/**
 * lib/zoning-lookup.ts
 * -----------------------------------------------------------------------
 * ნაკვეთის (parcel geometry) მიხედვით ზონის დადგენა — ანუ "ეს კონკრეტული
 * ნაკვეთი რომელ ზონაშია" (R-2? C-1? და ა.შ.).
 *
 * ეს მოითხოვს zoning-ის GIS ფენას (თბილისის მიწათსარგებლობის გენერალური
 * გეგმის რუკა). ისევე როგორც napr-client.ts-ის შემთხვევაში, საჯაროდ
 * დოკუმენტირებული API ამისთვის არ მოიძებნა. სავარაუდო წყაროები:
 *
 *   - maps.tbilisi.gov.ge ან maps.municipal.gov.ge
 *     (თბილისის მუნიციპალიტეტის საკუთარი GIS პორტალი — mentioned
 *     OSM-ის Georgia wiki-გვერდზეც, როგორც generalური ზონირების ფენის
 *     მასპინძელი)
 *   - შესაძლოა იგივე ArcGIS ინფრასტრუქტურა, რასაც napr იყენებს.
 *
 * !!! ეს ფაილი placeholder-ია, ისევე როგორც napr-client.ts !!!
 * endpoint-ის დასადგენად გაიმეორე იგივე DevTools-პროცედურა, რაც
 * README.md-შია აღწერილი, ოღონდ ამჯერად maps.tbilisi.gov.ge-ზე
 * (ან municipal.gov.ge-ზე), ზონირების ფენის ჩართვით.
 *
 * ტექნიკური მიდგომა, როცა endpoint დადგინდება:
 * ჩვეულებრივ ArcGIS "point-in-polygon" ტიპის query გამოიყენება —
 * ნაკვეთის ცენტროიდის (ან სრული polygon-ის) კოორდინატებით მოთხოვნა
 * იგზავნება ზონირების layer-ზე, და პასუხად ბრუნდება, რომელ ზონა-
 * პოლიგონში ხვდება წერტილი.
 */

import type { ZoneCode } from "./zoning-rules";

export interface ZoneLookupResult {
  zoneCode: ZoneCode;
  zoneNameKa: string;
  /** true, თუ ნაკვეთი ეხება რამდენიმე ზონას (საჭიროებს ხელით შემოწმებას) */
  isSplitZone: boolean;
  raw?: unknown;
}

const ZONING_GIS_BASE_URL = "https://maps.tbilisi.gov.ge"; // TODO: გადაამოწმე ზუსტი მისამართი/endpoint

/**
 * TODO: იმპლემენტაცია endpoint-ის დადგენის შემდეგ.
 * @param centroid [lng, lat] ნაკვეთის ცენტროიდი (napr-client.ts-ის
 *                 boundary-დან გამოთვლადი)
 */
export async function lookupZoneByLocation(
  centroid: [number, number]
): Promise<ZoneLookupResult> {
  throw new Error(
    "lookupZoneByLocation არ არის იმპლემენტირებული — " +
      "საჭიროა ზონირების GIS ფენის endpoint-ის დადგენა DevTools-ით " +
      "(იხ. ამ ფაილის თავში მითითებული ინსტრუქცია)."
  );

  // მაგალითი, თუ endpoint აღმოჩნდება ArcGIS query REST სერვისი:
  //
  // const [lng, lat] = centroid;
  // const url = new URL(`${ZONING_GIS_BASE_URL}/arcgis/rest/services/.../MapServer/<layerId>/query`);
  // url.searchParams.set("geometry", `${lng},${lat}`);
  // url.searchParams.set("geometryType", "esriGeometryPoint");
  // url.searchParams.set("inSR", "4326");
  // url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  // url.searchParams.set("outFields", "ZONE_CODE,ZONE_NAME");
  // url.searchParams.set("f", "json");
  //
  // const res = await fetch(url.toString());
  // const data = await res.json();
  // const feature = data.features?.[0];
  // if (!feature) throw new Error("ზონა ვერ დადგინდა ამ კოორდინატისთვის");
  //
  // return {
  //   zoneCode: feature.attributes.ZONE_CODE,
  //   zoneNameKa: feature.attributes.ZONE_NAME,
  //   isSplitZone: (data.features?.length ?? 0) > 1,
  //   raw: data,
  // };
}

/** ნაკვეთის polygon-ის ცენტროიდის მარტივი გამოთვლა (planar approximation) */
export function computeCentroid(boundary: [number, number][]): [number, number] {
  if (boundary.length === 0) throw new Error("ცარიელი boundary");
  const [sumLng, sumLat] = boundary.reduce(
    ([lng, lat], [pLng, pLat]) => [lng + pLng, lat + pLat],
    [0, 0]
  );
  return [sumLng / boundary.length, sumLat / boundary.length];
}
