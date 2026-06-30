"use client";

import { useState } from "react";

export function AvatarImg({
  src,
  alt,
  className = "w-20 h-20",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} rounded-full bg-brand-light flex items-center justify-center text-3xl`}>
        ✂️
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${className} rounded-full object-cover border-2 border-white shadow`}
      onError={() => setFailed(true)}
    />
  );
}
