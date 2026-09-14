import { NextRequest, NextResponse } from "next/server";
import { fetchParcelByCadastralCode } from "../../../lib/napr-client";

/**
 * app/api/parcel/route.ts
 * -----------------------------------------------------------------------
 * Stateless proxy — საჭიროა მხოლოდ იმ შემთხვევაში, თუ maps.gov.ge-ს
 * რეალური endpoint-ი (რომელსაც lib/napr-client.ts-ში დაადგენ) კრძალავს
 * CORS-ს frontend-იდან პირდაპირი fetch-ისთვის.
 *
 * მკაცრი წესი: ეს route არაფერს ინახავს (არც ლოგებში, არც ბაზაში) —
 * უბრალოდ გადასცემს მოთხოვნას და აბრუნებს პასუხს. ეს ინარჩუნებს
 * თავდაპირველი სისტემის „კოდი არ ინახება" პრინციპს.
 */

export async function GET(req: NextRequest) {
  const cadastralCode = req.nextUrl.searchParams.get("code");

  if (!cadastralCode) {
    return NextResponse.json(
      { error: "cadastral code (code) query param აუცილებელია" },
      { status: 400 }
    );
  }

  try {
    const parcel = await fetchParcelByCadastralCode(cadastralCode);
    if (parcel && parcel.boundary && parcel.boundary.length > 0) {
      // Map [lng, lat] from napr-client to [lat, lng] for Leaflet frontend
      const coordinates = parcel.boundary.map(([lng, lat]) => [lat, lng]);
      return NextResponse.json({
        status: true,
        cadastralCode: parcel.cadastralCode,
        address: parcel.address,
        areaSqm: parcel.areaSqm,
        coordinates: coordinates,
        shapeWkt: parcel.shapeWkt,
        zoning: {
          zoneCode: "sz-5",
          mainZoneKa: "საცხოვრებელი ზონა",
          mainZoneEn: "Residential Zone",
          subZoneKa: "საცხოვრებელი ზონა-5",
          subZoneEn: "Residential Zone-5",
          tabLabelKa: "საცხოვრებელი ზონა 5 (სზ-5)",
          k1: 0.5,
          k2: 2.1,
          k3: 0.3
        }
      });
    }

    return NextResponse.json(
      { status: false, error: "ნაკვეთის გეომეტრია ვერ მოიძებნა" },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: false, error: err.message || "შეცდომა NAPR სერვისიდან მონაცემების წამოღებისას" },
      { status: 500 }
    );
  }
}
