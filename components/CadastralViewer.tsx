"use client";

import { useMemo, useState } from "react";

/**
 * CadastralViewer
 * -----------------------------------------------------------------------
 * მიზანი: მომხმარებელმა შეიყვანოს საკადასტრო კოდი, სისტემამ ვალიდაცია
 * გაუკეთოს ფორმატს და ნაკვეთი აჩვენოს maps.gov.ge-ს (NAPR — საჯარო
 * რეესტრის ეროვნული სააგენტოს) საჯარო რუკის პორტალზე, embed/iframe
 * სახით, ისე რომ ძებნა ხდება მომხმარებლის ბრაუზერიდან და კოდი არსად
 * არ ინახება ჩვენს მხარეს.
 *
 * მნიშვნელოვანი შენიშვნა:
 * maps.gov.ge-ს არ აქვს საჯაროდ დოკუმენტირებული REST API კადასტრული
 * კოდით ძებნისთვის. ამიტომ ეს კომპონენტი იყენებს "safe" მიდგომას —
 * პორტალის პირდაპირ embed-ს — და არა გამოგონილ API-calls-ს.
 *
 * თუ გინდა ნაკვეთის ატრიბუტების (ფართობი, მისამართი, კონტურის
 * კოორდინატები) პროგრამული წაკითხვაც (და არა მხოლოდ ვიზუალური ჩვენება),
 * იხილე lib/napr-client.ts — იქ არის სკაფოლდი, რომლის ბოლომდე შევსებაც
 * შესაძლებელია მხოლოდ მას შემდეგ, რაც DevTools→Network-ში ნახავთ
 * რეალურ request/response-ს (იხ. README-ში ინსტრუქცია).
 */

// ქართული საკადასტრო კოდის ტიპური ფორმატი: XX.XX.XX.XXX.XXX ან XX-XX-XX-XXX-XXX
// (სექციები შეიძლება იყოს 2-3 ციფრიანი — საჭიროებისამებრ დაარეგულირე).
const CADASTRAL_CODE_REGEX = /^\d{2}[.\-]\d{2}[.\-]\d{2}[.\-]\d{2,3}[.\-]\d{2,3}$/;

function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function isValidCadastralCode(code: string): boolean {
  return CADASTRAL_CODE_REGEX.test(normalizeCode(code));
}

interface CadastralViewerProps {
  /** როცა ვალიდური კოდი შეყვანილია — გარე კომპონენტს (მაგ. 3D სცენას) ეცნობება */
  onCodeSubmit?: (code: string) => void;
}

export default function CadastralViewer({ onCodeSubmit }: CadastralViewerProps) {
  const [inputValue, setInputValue] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(
    () => (inputValue ? isValidCadastralCode(inputValue) : false),
    [inputValue]
  );

  // maps.gov.ge-ს პორტალის ბაზისური URL. პარამეტრი, რომლითაც შესაძლოა
  // მოხდეს ავტომატური ძებნა (მაგ. ?q= ან ?searchText=), საჭიროებს
  // დადასტურებას რეალურ ბრაუზერში ტესტირებით — იხ. README.
  // უსაფრთხოების მიზნით embed URL-ს ვაგზავნით მხოლოდ base portal-ზე,
  // და მომხმარებელს ვთხოვთ, თავად ჩაწეროს კოდი პორტალის ძებნის ველში
  // (ეს ზუსტად იმეორებს თავდაპირველი საიტის ქცევას).
  const portalUrl = "https://maps.gov.ge/map/portal";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(inputValue);

    if (!isValidCadastralCode(code)) {
      setError("საკადასტრო კოდის ფორმატი არასწორია (მაგ.: 01.10.09.001.001)");
      setSubmittedCode(null);
      return;
    }

    setError(null);
    setSubmittedCode(code);
    onCodeSubmit?.(code);

    // შენიშვნა: კოდი ინახება მხოლოდ React state-ში (in-memory),
    // არ იგზავნება ჩვენს backend-ზე და არ ჩაიწერება storage-ში.
  }

  function handleReset() {
    setInputValue("");
    setSubmittedCode(null);
    setError(null);
  }

  return (
    <div className="cadastral-viewer">
      <form onSubmit={handleSubmit} className="cadastral-viewer__form">
        <label htmlFor="cadastral-code" className="cadastral-viewer__label">
          საკადასტრო კოდი
        </label>
        <div className="cadastral-viewer__input-row">
          <input
            id="cadastral-code"
            type="text"
            inputMode="numeric"
            placeholder="01.10.09.001.001"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "cadastral-code-error" : undefined}
          />
          <button type="submit" disabled={!inputValue}>
            ძებნა
          </button>
        </div>
        {error && (
          <p id="cadastral-code-error" role="alert" className="cadastral-viewer__error">
            {error}
          </p>
        )}
        <p className="cadastral-viewer__hint">
          კოდი არსად არ ინახება — ძებნა ხდება პირდაპირ maps.gov.ge-ზე, შენი ბრაუზერიდან.
        </p>
      </form>

      {submittedCode && (
        <div className="cadastral-viewer__result">
          <div className="cadastral-viewer__toolbar">
            <span>
              ნაკვეთი: <strong>{submittedCode}</strong>
            </span>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cadastral-viewer__open-link"
            >
              გახსენი ცალკე ტაბში ↗
            </a>
            <button type="button" onClick={handleReset}>
              ახალი ძებნა
            </button>
          </div>

          {/*
            iframe embed. NB: ზოგიერთი სამთავრობო პორტალი კრძალავს
            embedding-ს X-Frame-Options / CSP header-ებით. თუ iframe
            ცარიელი/დაბლოკილი გამოჩნდება, გამოიყენე ზემოთ "გახსენი
            ცალკე ტაბში" ბმული, როგორც ერთადერთი სანდო ალტერნატივა.
          */}
          <iframe
            src={portalUrl}
            title={`მიწის ნაკვეთი — ${submittedCode}`}
            className="cadastral-viewer__iframe"
            loading="lazy"
          />

          <p className="cadastral-viewer__manual-step">
            პორტალის ძებნის ველში ჩაწერე კოდი: <code>{submittedCode}</code>
            {" "}(ავტომატური querystring-ძებნა ჯერ დაუდასტურებელია — იხ. README).
          </p>
        </div>
      )}
    </div>
  );
}
