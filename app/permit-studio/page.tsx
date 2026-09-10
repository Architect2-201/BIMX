"use client";

import { useState } from "react";
import CadastralViewer from "../../components/CadastralViewer";
import PermitAnalysisCard from "../../components/PermitAnalysisCard";
import { fetchParcelByCadastralCode, type ParcelData } from "../../lib/napr-client";
import { computeCentroid, lookupZoneByLocation } from "../../lib/zoning-lookup";
import { getZoneRule } from "../../lib/zoning-rules";
import { analyzeParcel, type PermitAnalysisResult } from "../../lib/permit-analysis";

export default function PermitStudioPage() {
  const [analysis, setAnalysis] = useState<PermitAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCodeSubmit(code: string) {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // 1) ნაკვეთის მონაცემები (napr-client.ts — endpoint-ის დადგენამდე გაისვრის error-ს)
      const parcel: ParcelData = await fetchParcelByCadastralCode(code);

      // 2) ზონის დადგენა ნაკვეთის მდებარეობით (zoning-lookup.ts — იგივე სტატუსი)
      const centroid = computeCentroid(parcel.boundary);
      const zoneResult = await lookupZoneByLocation(centroid);

      // 3) ზონის წესები (zoning-rules.ts)
      const zoneRule = getZoneRule(zoneResult.zoneCode);
      if (!zoneRule) {
        throw new Error(`ზონისთვის "${zoneResult.zoneCode}" წესები ჯერ არ არის დამატებული.`);
      }

      // 4) ანალიზი
      const result = analyzeParcel(parcel, zoneRule);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "უცნობი შეცდომა");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="permit-studio-page">
      <h1>Permit Studio</h1>
      <CadastralViewer onCodeSubmit={handleCodeSubmit} />

      {loading && <p>მიმდინარეობს ანალიზი...</p>}
      {error && (
        <p role="alert" className="permit-studio-page__error">
          {error}
        </p>
      )}
      {analysis && <PermitAnalysisCard result={analysis} />}
    </main>
  );
}
