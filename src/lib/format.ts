/** Formata centavos como moeda BRL: 4990 => "R$ 49,90" */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);
}

/** Converte "49,90" ou "49.90" em centavos (4990). */
export function parseToCents(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Retorna a data de hoje no fuso horário de Brasília (YYYY-MM-DD). */
export function getTodayBR(): string {
  return new Date()
    .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    .split("/")
    .reverse()
    .join("-");
}

/** Retorna a data de hoje + N dias, no fuso horário de Brasília. N pode ser negativo. */
export function addDaysBR(days: number): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Gera slug a partir de um texto: "Studio da Ana" => "studio-da-ana" */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
