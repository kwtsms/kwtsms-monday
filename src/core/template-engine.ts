export interface TemplateContext {
  item?: { id?: string; name?: string };
  columns?: Record<string, string>;
  user?: { name?: string };
  board?: { name?: string };
}

export interface TemplateResult {
  body: string;
  warnings: string[];
}

const TOKEN_RE = /\{([a-z]+)\.([^}]+)\}/g;

export function resolveTemplate(body: string, ctx: TemplateContext): TemplateResult {
  const warnings: string[] = [];
  const out = body.replace(TOKEN_RE, (full, ns, key) => {
    const value = lookup(ns, key, ctx);
    if (value === undefined) {
      warnings.push(`${ns}.${key}`);
      return full;
    }
    return String(value);
  });
  return { body: out, warnings };
}

function lookup(ns: string, key: string, ctx: TemplateContext): string | undefined {
  if (ns === 'item') return (ctx.item as any)?.[key];
  if (ns === 'column') return ctx.columns?.[key];
  if (ns === 'user') return (ctx.user as any)?.[key];
  if (ns === 'board') return (ctx.board as any)?.[key];
  return undefined;
}
