"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function PixDisplay({
  payload,
  amountLabel,
}: {
  payload: string;
  amountLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!payload) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      {amountLabel && (
        <p className="text-2xl font-bold text-slate-900">{amountLabel}</p>
      )}
      <div className="bg-white p-3 rounded-2xl border border-slate-200">
        <QRCodeSVG value={payload} size={200} level="M" />
      </div>
      <div className="w-full">
        <p className="text-xs text-slate-500 mb-1.5 text-center">
          Pix copia e cola
        </p>
        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={payload}
            className="input text-xs flex-1 bg-slate-50 truncate"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={copy} className="btn-primary px-4 whitespace-nowrap">
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 text-center">
        Escaneie o QR Code ou cole o código no app do seu banco.
      </p>
    </div>
  );
}
