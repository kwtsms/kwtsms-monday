// SMS segment counter following the GSM-7 / UCS-2 rules documented at
// https://www.kwtsms.com/faq/sms-message-length.html
//
// Rules:
//   - If every character is in GSM-7 basic or extended, encoding is GSM-7:
//       1 segment = 160 chars, multi-segment = 153 per segment.
//       Extended chars (^{}[]\~|€) count as 2.
//   - If any character falls outside GSM-7, encoding is UCS-2 (Unicode):
//       1 segment = 70 chars, multi-segment = 67 per segment.
//       Non-BMP chars (emoji) count as 2 (surrogate pair).

const GSM7_BASIC = new Set<string>([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ':', ';', '<', '=', '>', '?', '¡',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'Ä', 'Ö', 'Ñ', 'Ü', '§', '¿',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'ä', 'ö', 'ñ', 'ü', 'à',
]);

const GSM7_EXT = new Set<string>(['\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€']);

export interface SmsCount {
  count: number;
  pages: number;
  unicode: boolean;
  perPage: number;
  remaining: number;
}

export function countSms(body: string): SmsCount {
  let count = 0;
  let unicode = false;
  for (const ch of body) {
    if (GSM7_BASIC.has(ch)) count += 1;
    else if (GSM7_EXT.has(ch)) count += 2;
    else {
      unicode = true;
      break;
    }
  }

  if (unicode) {
    count = 0;
    for (const ch of body) count += ch.length;
  }

  const singleLimit = unicode ? 70 : 160;
  const concatLimit = unicode ? 67 : 153;

  let pages: number;
  let perPage: number;
  if (count === 0) {
    pages = 1;
    perPage = singleLimit;
  } else if (count <= singleLimit) {
    pages = 1;
    perPage = singleLimit;
  } else {
    pages = Math.ceil(count / concatLimit);
    perPage = concatLimit;
  }

  const remaining = pages * perPage - count;
  return { count, pages, unicode, perPage, remaining };
}
