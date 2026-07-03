"use client";

import { useEffect } from "react";

// Registra o service worker (/sw.js) após o load — habilita PWA instalável
// e cache offline básico. Falhas são silenciosas (não quebram o app).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
