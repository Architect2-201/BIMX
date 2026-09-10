/**
 * lib/permit-analysis.ts
 * -----------------------------------------------------------------------
 * ცენტრალური "ანალიზის ძრავა" — იღებს ნაკვეთის მონაცემებს (ParcelData,
 * napr-client.ts-დან) + ზონის წესებს (ZoneRule, zoning-rules.ts-დან) და
 * აბრუნებს სტრუქტურირებულ ანალიზს:
 *   - შესაძლებელია თუ არა მშენებლობა,
 *   - რა ტიპის მშენებლობაა დასაშვები,
 *   - მინიმალური მოთხოვნები,
 *   - შეზღუდვები და ვალდებულებები.
 *
 * ეს ფაილი თავად წარმოადგენს "სუფთა" ლოგიკას (pure functions) — არ
 * აკეთებს fetch-ს, არ არის დამოკიდებული უცნობ API-ზე. მისი სისწორე
 * მთლიანად დამოკიდებულია input-ის ხარისხზე:
 *   parcel  ← napr-client.ts (რეალური მონაცემი მას შემდეგ რაც endpoint
 *             დადგინდება)
 *   zone    ← zoning-lookup.ts + zoning-rules.ts (რეალური მონაცემი მას
 *             შემდეგ რაც ორივე დადასტურდება)
 *
 * თუ ან parcel, ან zoneRule არასრულია (isZoneRuleVerified === false),
 * ანალიზი აუცილებლად აღნიშნავს low-confidence სტატუსს — არასდროს არ
 * აჩვენებს ცრუ-დარწმუნებულ დასკვნას დაუდასტურებელ მონაცემზე დაყრდნობით.
 */

import type { ParcelData } from "./napr-client";
import { type ZoneRule, isZoneRuleVerified } from "./zoning-rules";

export type BuildabilityStatus =
  | "BUILDABLE"              // მშენებლობა პრინციპულად შესაძლებელია
  | "CONDITIONAL"            // შესაძლებელია დამატებითი პირობით/თანხმობით
  | "NOT_BUILDABLE"          // ზონის/ფართობის მიხედვით არ არის დასაშვები
  | "INSUFFICIENT_DATA";     // მონაცემი არასაკმარისია დასკვნისთვის

export interface PermitAnalysisResult {
  status: BuildabilityStatus;
  confidence: "verified" | "unverified_placeholder";

  zoneCode: string;
  zoneNameKa: string;

  parcelAreaSqm: number;
  minPlotAreaSqm: number | null;
  meetsMinPlotArea: boolean | null;

  coefficients: {
    k1: number | null;
    k2: number | null;
  };

  maxAllowedFootprintSqm: number | null; // parcelArea * k1, თუ k1 ცნობილია
  maxHeightM: number | null;
  maxFloors: number | null;

  setbacks: ZoneRule["setbacks"];

  permittedUses: string[];
  conditionalUses: string[];
  restrictions: string[];
  obligations: string[];

  /** ადამიანისთვის წასაკითხი შეჯამება ქართულად */
  summaryKa: string;

  /** სავალდებულო იურიდიული disclaimer — ყოველთვის თან ახლდეს UI-ში */
  disclaimerKa: string;
}

const DISCLAIMER_KA =
  "ეს ანალიზი არის წინასწარი, საინფორმაციო შეფასება არსებული საჯარო " +
  "მონაცემების საფუძველზე და არ წარმოადგენს იურიდიულ დასკვნას ან " +
  "საპროექტო დავალებას. მშენებლობის საბოლოო პარამეტრებს ადგენს " +
  "შესაბამისი მუნიციპალიტეტის ორგანო (გეგმარებითი დავალების/ნებართვის " +
  "გაცემისას). სავალდებულოა სერტიფიცირებულ არქიტექტორთან/იურისტთან " +
  "და მუნიციპალიტეტთან გადამოწმება საბოლოო გადაწყვეტილებამდე.";

export function analyzeParcel(
  parcel: ParcelData,
  zoneRule: ZoneRule
): PermitAnalysisResult {
  const verified = isZoneRuleVerified(zoneRule);

  const meetsMinPlotArea =
    zoneRule.minPlotAreaSqm != null
      ? parcel.areaSqm >= zoneRule.minPlotAreaSqm
      : null;

  const maxAllowedFootprintSqm =
    zoneRule.k1 != null ? Number((parcel.areaSqm * zoneRule.k1).toFixed(1)) : null;

  const restrictions = [...zoneRule.specialRestrictions];
  const obligations: string[] = [];

  // მინ. ფართობის შეზღუდვის აღწერითი ტექსტი
  if (meetsMinPlotArea === false) {
    restrictions.push(
      `ნაკვეთის ფართობი (${parcel.areaSqm} მ²) ნაკლებია ზონისთვის ` +
        `დადგენილ მინიმალურ ფართობზე (${zoneRule.minPlotAreaSqm} მ²).`
    );
  }

  // სტატუსის განსაზღვრა
  let status: BuildabilityStatus;
  if (!verified) {
    status = "INSUFFICIENT_DATA";
  } else if (meetsMinPlotArea === false) {
    status = "NOT_BUILDABLE";
  } else if (zoneRule.conditionalUses.length > 0 && zoneRule.permittedUses.length === 0) {
    status = "CONDITIONAL";
  } else {
    status = "BUILDABLE";
  }

  // ვალდებულებების ავტომატური გენერაცია ცნობილი წესებიდან
  if (zoneRule.setbacks.front != null) {
    obligations.push(`ფასადის ხაზიდან უკან დახევა მინიმუმ ${zoneRule.setbacks.front} მ.`);
  }
  if (zoneRule.setbacks.side != null) {
    obligations.push(`გვერდითი საზღვრიდან უკან დახევა მინიმუმ ${zoneRule.setbacks.side} მ.`);
  }
  if (zoneRule.setbacks.rear != null) {
    obligations.push(`უკანა საზღვრიდან უკან დახევა მინიმუმ ${zoneRule.setbacks.rear} მ.`);
  }
  if (zoneRule.maxHeightM != null) {
    obligations.push(`სიმაღლე არ უნდა აღემატებოდეს ${zoneRule.maxHeightM} მ-ს.`);
  }

  const summaryKa = buildSummary({
    status,
    verified,
    zoneNameKa: zoneRule.zoneNameKa,
    parcelAreaSqm: parcel.areaSqm,
    maxAllowedFootprintSqm,
    maxHeightM: zoneRule.maxHeightM,
  });

  return {
    status,
    confidence: verified ? "verified" : "unverified_placeholder",
    zoneCode: zoneRule.zoneCode,
    zoneNameKa: zoneRule.zoneNameKa,
    parcelAreaSqm: parcel.areaSqm,
    minPlotAreaSqm: zoneRule.minPlotAreaSqm,
    meetsMinPlotArea,
    coefficients: { k1: zoneRule.k1, k2: zoneRule.k2 },
    maxAllowedFootprintSqm,
    maxHeightM: zoneRule.maxHeightM,
    maxFloors: zoneRule.maxFloors,
    setbacks: zoneRule.setbacks,
    permittedUses: zoneRule.permittedUses,
    conditionalUses: zoneRule.conditionalUses,
    restrictions,
    obligations,
    summaryKa,
    disclaimerKa: DISCLAIMER_KA,
  };
}

function buildSummary(args: {
  status: BuildabilityStatus;
  verified: boolean;
  zoneNameKa: string;
  parcelAreaSqm: number;
  maxAllowedFootprintSqm: number | null;
  maxHeightM: number | null;
}): string {
  if (!args.verified) {
    return (
      `ნაკვეთი მდებარეობს ზონაში „${args.zoneNameKa}", მაგრამ ამ ზონისთვის ` +
      `კოეფიციენტების/შეზღუდვების მონაცემი ჯერ არ არის დადასტურებული ` +
      `მოქმედ კანონმდებლობასთან — ზუსტი დასკვნის გაცემა ამ ეტაპზე ვერ ხერხდება.`
    );
  }

  switch (args.status) {
    case "BUILDABLE":
      return (
        `ნაკვეთი (${args.parcelAreaSqm} მ²) მდებარეობს ზონაში „${args.zoneNameKa}" ` +
        `და, ხელმისაწვდომი მონაცემით, მშენებლობა პრინციპულად დასაშვებია. ` +
        (args.maxAllowedFootprintSqm != null
          ? `მაქსიმალური დასაშვები ჯამური ფართობი დაახლოებით ${args.maxAllowedFootprintSqm} მ². `
          : "") +
        (args.maxHeightM != null ? `მაქსიმალური სიმაღლე — ${args.maxHeightM} მ.` : "")
      );
    case "CONDITIONAL":
      return `ნაკვეთზე მშენებლობა შესაძლებელია მხოლოდ დამატებითი პირობის/თანხმობის საფუძველზე — იხ. „პირობითად დასაშვები" გამოყენებები.`;
    case "NOT_BUILDABLE":
      return `ხელმისაწვდომი მონაცემით, ნაკვეთი არ აკმაყოფილებს ზონისთვის დადგენილ მინიმალურ მოთხოვნებს მშენებლობისთვის.`;
    case "INSUFFICIENT_DATA":
    default:
      return `ანალიზისთვის საკმარისი დადასტურებული მონაცემი არ არის.`;
  }
}
