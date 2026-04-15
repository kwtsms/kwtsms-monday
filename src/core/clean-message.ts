const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;
const ZERO_WIDTH_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const CONTROL_RE = /[\x00-\x08\x0B-\x1F\x7F]/g;

export function cleanMessage(input: string): { body: string; changed: boolean } {
  const before = input;
  let out = input.replace(EMOJI_RE, '');
  out = out.replace(ZERO_WIDTH_RE, '');
  out = out.replace(CONTROL_RE, '');
  out = out.trim();
  return { body: out, changed: out !== before };
}
