"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    elRef.current = div;
    setMounted(true);

    // Trava o scroll do body enquanto o modal estiver aberto
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
      div.remove();
    };
  }, []);

  if (!mounted || !elRef.current) return null;
  return createPortal(children, elRef.current);
}
