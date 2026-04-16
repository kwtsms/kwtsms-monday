// Each namespace is a free-form bag: whatever scalar fields the caller
// populates become reachable as {ns.key}. We don't enumerate keys here so
// that adding a field to the fetch queries automatically exposes it to
// templates with no engine changes.
export interface TemplateContext {
  item?: Record<string, unknown>;
  columns?: Record<string, string>;
  user?: Record<string, unknown>;
  board?: Record<string, unknown>;
}

export interface TemplateResult {
  body: string;
  warnings: string[];
}

// Namespace match is intentionally case-insensitive: {ITEM.name}, {Item.name}
// and {item.name} all resolve the same way. Key lookup stays case-sensitive
// (case-insensitive for columns is handled inside the lookup).
const TOKEN_RE = /\{([a-zA-Z]+)(?:\.([^}]+))?\}/g;

// kwtSMS customers are primarily Kuwait + GCC where the whole region is on
// +03:00 with no DST, so formatting in Asia/Kuwait gives the right wall-clock
// time everywhere it matters.
const TZ = 'Asia/Kuwait';

function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()); // en-CA returns YYYY-MM-DD
}

function now(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

export function resolveTemplate(body: string, ctx: TemplateContext): TemplateResult {
  const warnings: string[] = [];
  const out = body.replace(TOKEN_RE, (_full, nsRaw, key) => {
    const ns = (nsRaw as string).toLowerCase();
    const value = lookup(ns, key, ctx);
    if (value === undefined || value === null) {
      // Always substitute - never leave {foo.bar} literal in the outgoing SMS
      // even if the field is missing/null. Warnings are still emitted for
      // upstream surfaces that want to preview them.
      warnings.push(key ? `${ns}.${key}` : ns);
      return '';
    }
    return String(value);
  });
  return { body: out, warnings };
}

function lookup(ns: string, key: string | undefined, ctx: TemplateContext): string | undefined {
  // Zero-argument placeholders: {date} and {time}.
  if (ns === 'date' && !key) return today();
  if (ns === 'time' && !key) return now();
  if (!key) return undefined;

  if (ns === 'item') return (ctx.item as any)?.[key];
  if (ns === 'column') {
    const cols = ctx.columns ?? {};
    if (key in cols) return cols[key];
    const lower = key.toLowerCase();
    for (const k of Object.keys(cols)) {
      if (k.toLowerCase() === lower) return cols[k];
    }
    return undefined;
  }
  if (ns === 'user') return (ctx.user as any)?.[key];
  if (ns === 'board') return (ctx.board as any)?.[key];
  return undefined;
}
