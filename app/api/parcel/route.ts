import { NextRequest, NextResponse } from "next/server";

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

  // TODO: ჩაანაცვლე რეალური NAPR/maps.gov.ge endpoint-ით
  // (იხ. lib/napr-client.ts-ის თავში მითითებული ინსტრუქცია).
  return NextResponse.json(
    {
      error:
        "Proxy ჯერ არ არის კონფიგურირებული — შეავსე რეალური upstream URL " +
        "app/api/parcel/route.ts-ში, მას შემდეგ რაც დაადგენ ზუსტ endpoint-ს.",
    },
    { status: 501 }
  );

  // მაგალითი რეალური იმპლემენტაციისთვის:
  //
  // const upstreamUrl = `https://<REAL_NAPR_ENDPOINT>/query?where=CADASTRAL_CODE='${cadastralCode}'&f=geojson`;
  // const upstreamRes = await fetch(upstreamUrl);
  // if (!upstreamRes.ok) {
  //   return NextResponse.json({ error: "NAPR request failed" }, { status: 502 });
  // }
  // const data = await upstreamRes.json();
  // return NextResponse.json(data);
  // // ← შენიშვნა: არც აქ ხდება cadastralCode-ის შენახვა disk/db-ზე,
  // //   მხოლოდ request-ის სიცოცხლის ხანგრძლივობით მეხსიერებაშია.
}
