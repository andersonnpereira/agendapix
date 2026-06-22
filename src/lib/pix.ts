/**
 * Gerador de Pix BR Code (padrão EMV / Banco Central).
 * Gera o "copia e cola" estático a partir da chave Pix do recebedor.
 *
 * Referência: Manual do BR Code (Bacen) + especificação EMV MPM.
 * Não depende de nenhum provedor de pagamento. O dinheiro cai direto
 * na conta do dono da chave Pix.
 */

export type PixKeyType = "celular" | "email" | "cpf_cnpj" | "aleatoria";

export interface PixParams {
  pixKey: string;
  amount: number; // em reais, ex: 49.9
  merchantName: string; // nome do recebedor (max 25 chars)
  merchantCity: string; // cidade do recebedor (max 15 chars)
  txid?: string; // identificador da transação (max 25 chars), default "***"
}

/** Monta um campo EMV no formato ID + LEN(2 dígitos) + VALUE. */
function emv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF).
 * Calculado sobre toda a string até "6304" inclusive.
 */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acentos e caracteres não suportados pelo padrão. */
function sanitize(text: string, maxLen: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s.\-]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, maxLen);
}

/**
 * Normaliza a chave Pix conforme o tipo.
 * - celular: formato +55DDNNNNNNNNN
 * - cpf_cnpj: só dígitos
 * - email / aleatoria: como informado (email em minúsculas)
 */
export function normalizePixKey(key: string, type: PixKeyType): string {
  switch (type) {
    case "celular": {
      const digits = key.replace(/\D/g, "");
      // se já vier com 55 na frente mantém, senão adiciona
      const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
      return `+${withCountry}`;
    }
    case "cpf_cnpj":
      return key.replace(/\D/g, "");
    case "email":
      return key.trim().toLowerCase();
    case "aleatoria":
    default:
      return key.trim();
  }
}

/**
 * Gera o payload completo do Pix "copia e cola".
 */
export function generatePixBRCode(params: PixParams): string {
  const { pixKey, amount, merchantName, merchantCity, txid = "***" } = params;

  // Merchant Account Information (ID 26) - arranjo Pix
  const gui = emv("00", "br.gov.bcb.pix");
  const key = emv("01", pixKey);
  const merchantAccountInfo = emv("26", `${gui}${key}`);

  const payloadFormat = emv("00", "01"); // versão do payload
  const pointOfInitiationMethod = emv("01", "11"); // 11 = estático reutilizável
  const merchantCategoryCode = emv("52", "0000");
  const transactionCurrency = emv("53", "986"); // BRL
  const transactionAmount =
    amount > 0 ? emv("54", amount.toFixed(2)) : "";
  const countryCode = emv("58", "BR");
  const name = emv("59", sanitize(merchantName, 25));
  const city = emv("60", sanitize(merchantCity, 15));

  // Additional Data Field (ID 62) com txid (ID 05)
  const additionalData = emv("62", emv("05", sanitize(txid, 25) || "***"));

  const partial =
    payloadFormat +
    pointOfInitiationMethod +
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    name +
    city +
    additionalData +
    "6304"; // ID do CRC + tamanho, antes do cálculo

  const checksum = crc16(partial);
  return partial + checksum;
}

/** Validações simples de formato por tipo de chave. */
export function validatePixKey(
  key: string,
  type: PixKeyType
): { valid: boolean; message?: string } {
  if (!key.trim()) return { valid: false, message: "Informe a chave Pix." };

  switch (type) {
    case "email": {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key.trim());
      return ok ? { valid: true } : { valid: false, message: "E-mail inválido." };
    }
    case "celular": {
      const digits = key.replace(/\D/g, "");
      const ok = digits.length >= 10 && digits.length <= 13;
      return ok
        ? { valid: true }
        : { valid: false, message: "Telefone inválido. Use DDD + número." };
    }
    case "cpf_cnpj": {
      const digits = key.replace(/\D/g, "");
      const ok = digits.length === 11 || digits.length === 14;
      return ok
        ? { valid: true }
        : { valid: false, message: "CPF deve ter 11 e CNPJ 14 dígitos." };
    }
    case "aleatoria": {
      const ok = /^[0-9a-fA-F-]{32,36}$/.test(key.trim());
      return ok
        ? { valid: true }
        : { valid: false, message: "Chave aleatória inválida." };
    }
    default:
      return { valid: false, message: "Tipo de chave desconhecido." };
  }
}
