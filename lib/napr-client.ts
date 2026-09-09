/**
 * lib/napr-client.ts
 * -----------------------------------------------------------------------
 * სკაფოლდი ნაკვეთის ატრიბუტების (კონტური/geometry, ფართობი, მისამართი)
 * პროგრამულად წასაკითხად — თუ საკმარისი არ არის მხოლოდ iframe-ვიზუალი
 * (CadastralViewer.tsx) და გინდა ამ მონაცემით 3D სცენის კვება.
 *
 * !!! ეს ფაილი განზრახ არასრულია. !!!
 * maps.gov.ge-ს არ აქვს საჯაროდ დოკუმენტირებული REST API, ამიტომ
 * ქვემოთ ნაჩვენები URL/პარამეტრები placeholder-ებია — არ იმუშავებს,
 * სანამ არ ჩაანაცვლებ რეალური მნიშვნელობებით.
 *
 * როგორ იპოვო რეალური endpoint (გააკეთე შენ ან Antigravity agent-მა
 * ავტომატიზირებული ბრაუზერის საშუალებით):
 *
 *   1. გახსენი https://maps.gov.ge/map/portal ჩვეულებრივ ბრაუზერში.
 *   2. გახსენი DevTools → Network ტაბი, ფილტრი: XHR/Fetch.
 *   3. საძიებო ველში ჩაწერე ცნობილი საკადასტრო კოდი და დააჭირე ძებნას.
 *   4. Network ტაბში იპოვე request, რომელიც აბრუნებს ნაკვეთის მონაცემს
 *      (ჩვეულებრივ ArcGIS-ტიპის პორტალებზე ეს არის
 *      `.../MapServer/<layerId>/query?where=...&outFields=...&f=json`
 *      ან მსგავსი "identify"/"query" endpoint).
 *   5. დააკოპირე ზუსტი URL, query-პარამეტრები და response-ის სტრუქტურა,
 *      და შეავსე ქვემოთ TODO-ები.
 *   6. გადაამოწმე, უშვებს თუ არა endpoint-ი frontend-იდან პირდაპირ
 *      მოთხოვნას (CORS header-ები). თუ არა — საჭირო იქნება
 *      Next.js API route, როგორც stateless proxy (მაგალითი ქვემოთ).
 */

export interface ParcelData {
  cadastralCode: string;
  /** GeoJSON-ის მსგავსი polygon კოორდინატები [lng, lat][] */
  boundary: [number, number][];
  areaSqm: number;
  address: string;
  /** ნედლი პასუხი debugging-ისთვის, production-ში ამოღებადია */
  raw?: unknown;
}

const NAPR_BASE_URL = "https://maps.gov.ge/map/portal"; // TODO: ჩაანაცვლე რეალური MapServer/query URL-ით

/**
 * TODO: ეს ფუნქცია ამჟამად წარმოადგენს placeholder-ს.
 * შეავსე რეალური fetch-ლოგიკით მას შემდეგ, რაც დაადგენ ზუსტ endpoint-ს.
 */
export async function fetchParcelByCadastralCode(
  cadastralCode: string
): Promise<ParcelData> {
  throw new Error(
    "fetchParcelByCadastralCode არ არის იმპლემენტირებული — " +
      "საჭიროა NAPR_BASE_URL-ის და query-პარამეტრების დადასტურება DevTools-ით. " +
      "იხილე ამ ფაილის თავში მითითებული ინსტრუქცია."
  );

  // მაგალითი, თუ endpoint აღმოჩნდება ArcGIS-ტიპის "query" REST სერვისი:
  //
  // const url = new URL(`${NAPR_BASE_URL}/query`);
  // url.searchParams.set("where", `CADASTRAL_CODE='${cadastralCode}'`);
  // url.searchParams.set("outFields", "*");
  // url.searchParams.set("f", "geojson");
  //
  // const res = await fetch(url.toString());
  // if (!res.ok) throw new Error(`NAPR request failed: ${res.status}`);
  // const data = await res.json();
  //
  // const feature = data.features?.[0];
  // if (!feature) throw new Error("ნაკვეთი ვერ მოიძებნა");
  //
  // return {
  //   cadastralCode,
  //   boundary: feature.geometry.coordinates[0],
  //   areaSqm: feature.properties.area,
  //   address: feature.properties.address,
  //   raw: feature,
  // };
}
