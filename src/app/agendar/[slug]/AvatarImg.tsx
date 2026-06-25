"use client";

import { useState } from "react";

export function AvatarImg({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mx-auto text-3xl">
        ✂️
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-white shadow"
      onError={() => setFailed(true)}
    />
  );
}
