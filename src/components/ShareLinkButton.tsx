"use client";

export function ShareLinkButton({ url, title }: { url: string; title: string }) {
  async function share() {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(title + "\n" + url)}`,
        "_blank"
      );
    }
  }

  return (
    <button
      onClick={share}
      title="Compartilhar"
      className="btn border border-brand text-brand hover:bg-brand-light px-3 py-2 text-sm"
    >
      ↗
    </button>
  );
}
