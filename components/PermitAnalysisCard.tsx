"use client";

import type { PermitAnalysisResult } from "../lib/permit-analysis";

const STATUS_LABELS: Record<PermitAnalysisResult["status"], { label: string; className: string }> = {
  BUILDABLE: { label: "მშენებლობა დასაშვებია", className: "status--ok" },
  CONDITIONAL: { label: "მშენებლობა პირობითად დასაშვებია", className: "status--warn" },
  NOT_BUILDABLE: { label: "მშენებლობა არ არის დასაშვები", className: "status--danger" },
  INSUFFICIENT_DATA: { label: "მონაცემი არასაკმარისია", className: "status--unknown" },
};

export default function PermitAnalysisCard({ result }: { result: PermitAnalysisResult }) {
  const statusMeta = STATUS_LABELS[result.status];

  return (
    <div className="permit-analysis">
      {result.confidence === "unverified_placeholder" && (
        <div className="permit-analysis__warning" role="alert">
          ⚠️ ამ ზონისთვის კოეფიციენტები/შეზღუდვები ჯერ არ არის დადასტურებული
          მოქმედ კანონმდებლობასთან (იხ. lib/zoning-rules.ts). ქვემოთ ნაჩვენები
          მონაცემი — მხოლოდ სტრუქტურის მაგალითია, არა საბოლოო დასკვნა.
        </div>
      )}

      <div className={`permit-analysis__status ${statusMeta.className}`}>
        {statusMeta.label}
      </div>

      <p className="permit-analysis__summary">{result.summaryKa}</p>

      <section>
        <h3>ზონა</h3>
        <p>
          {result.zoneCode} — {result.zoneNameKa}
        </p>
      </section>

      <section>
        <h3>ნაკვეთის ფართობი</h3>
        <p>
          {result.parcelAreaSqm} მ²
          {result.minPlotAreaSqm != null && (
            <>
              {" "}
              (მინიმალური მოთხოვნა: {result.minPlotAreaSqm} მ² —{" "}
              {result.meetsMinPlotArea ? "აკმაყოფილებს" : "არ აკმაყოფილებს"})
            </>
          )}
        </p>
      </section>

      <section>
        <h3>კოეფიციენტები</h3>
        <ul>
          <li>K-1: {result.coefficients.k1 ?? "დაუდასტურებელია"}</li>
          <li>K-2: {result.coefficients.k2 ?? "დაუდასტურებელია"}</li>
          {result.maxAllowedFootprintSqm != null && (
            <li>მაქსიმალური დასაშვები ჯამური ფართობი: {result.maxAllowedFootprintSqm} მ²</li>
          )}
        </ul>
      </section>

      <section>
        <h3>სიმაღლე</h3>
        <p>
          {result.maxHeightM != null ? `${result.maxHeightM} მ` : "დაუდასტურებელია"}
          {result.maxFloors != null && ` (${result.maxFloors} სართული)`}
        </p>
      </section>

      <section>
        <h3>უკან დახევა</h3>
        <ul>
          <li>ფასადიდან: {result.setbacks.front ?? "—"} მ</li>
          <li>გვერდიდან: {result.setbacks.side ?? "—"} მ</li>
          <li>უკნიდან: {result.setbacks.rear ?? "—"} მ</li>
        </ul>
      </section>

      <section>
        <h3>დასაშვები დანიშნულებები</h3>
        <ul>
          {result.permittedUses.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </section>

      {result.conditionalUses.length > 0 && (
        <section>
          <h3>პირობითად დასაშვები</h3>
          <ul>
            {result.conditionalUses.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      )}

      {result.restrictions.length > 0 && (
        <section>
          <h3>შეზღუდვები</h3>
          <ul>
            {result.restrictions.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {result.obligations.length > 0 && (
        <section>
          <h3>ვალდებულებები</h3>
          <ul>
            {result.obligations.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="permit-analysis__disclaimer">{result.disclaimerKa}</p>
    </div>
  );
}
