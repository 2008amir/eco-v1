import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

/* Scope <style> blocks from rendered post HTML so internal CSS doesn't leak into the site UI. */
export function scopeCssRules(css: string, scope: string): string {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let i = 0;
  while (i < noComments.length) {
    if (noComments[i] === "@") {
      const semi = noComments.indexOf(";", i);
      const brace = noComments.indexOf("{", i);
      if (brace === -1 || (semi !== -1 && semi < brace)) {
        out += noComments.slice(i, semi + 1); i = semi + 1; continue;
      }
      let depth = 0, j = brace;
      for (; j < noComments.length; j++) {
        if (noComments[j] === "{") depth++;
        else if (noComments[j] === "}") { depth--; if (depth === 0) { j++; break; } }
      }
      out += noComments.slice(i, brace + 1) + scopeCssRules(noComments.slice(brace + 1, j - 1), scope) + "}";
      i = j; continue;
    }
    const brace = noComments.indexOf("{", i);
    if (brace === -1) break;
    const close = noComments.indexOf("}", brace);
    if (close === -1) break;
    const selectors = noComments.slice(i, brace);
    const body = noComments.slice(brace + 1, close);
    const scoped = selectors.split(",").map((s) => {
      const t = s.trim();
      if (!t) return "";
      if (t === "html" || t === "body" || t === "*") return scope;
      return `${scope} ${t}`;
    }).filter(Boolean).join(", ");
    out += `${scoped}{${body}}`;
    i = close + 1;
  }
  return out;
}

export function splitContent(html: string): { styles: string[]; body: string } {
  const styles: string[] = [];
  const body = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    styles.push(String(css)); return "";
  });
  return { styles, body };
}

export function extractPageStyles(contentHtml: string | null | undefined) {
  const html = contentHtml || "";
  const styleMatch = html.match(/^<[^>]+style="([^"]*)"/i);
  if (!styleMatch) return { pageBg: undefined as string | undefined, pageColor: undefined as string | undefined };
  const style = styleMatch[1];
  const bgColor = style.match(/background-color:\s*([^;]+)/i)?.[1];
  const bgImage = style.match(/background-image:\s*([^;]+)/i)?.[1];
  const bg = style.match(/background:\s*([^;]+)/i)?.[1];
  const color = style.match(/(?:^|;)\s*color:\s*([^;]+)/i)?.[1];
  return { pageBg: bg || bgImage || bgColor || undefined, pageColor: color || undefined };
}

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "Roboto:wght@400;700","Open+Sans:wght@400;700","Lato:wght@400;700",
    "Montserrat:wght@400;700","Poppins:wght@400;700","Source+Sans+Pro:wght@400;700",
    "Nunito:wght@400;700","Raleway:wght@400;700","Merriweather:wght@400;700",
    "Playfair+Display:wght@400;700","Pacifico","Lobster","Dancing+Script:wght@400;700",
    "Great+Vibes","Satisfy","Caveat:wght@400;700","Shadows+Into+Light",
    "Permanent+Marker","Bangers","Press+Start+2P",
  ].map((f) => `family=${f}`).join("&") + "&display=swap";

let scopeCounter = 0;

/** Renders stored rich-editor HTML with its embedded styles scoped to this block. */
export function PostBody({ html, className, color }: { html: string | null | undefined; className?: string; color?: string }) {
  const scopeRef = useRef(`post-scope-${++scopeCounter}`);
  const { styles, body } = useMemo(() => splitContent(html || ""), [html]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const tagId = `scoped-${scopeRef.current}`;
    let tag = document.getElementById(tagId) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = tagId;
      document.head.appendChild(tag);
    }
    tag.textContent = styles.map((c) => scopeCssRules(c, `.${scopeRef.current}`)).join("\n");
    return () => { tag?.remove(); };
  }, [styles]);

  return (
    <>
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      <div
        className={cn("rich-editor-content rich-editor-light max-w-none w-full", scopeRef.current, className)}
        style={{ color, position: "relative" }}
        dangerouslySetInnerHTML={{ __html: body || "" }}
      />
    </>
  );
}

export const POST_KINDS = ["research", "project", "broadcast", "news"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const POST_KIND_LABELS: Record<PostKind, string> = {
  research: "Research",
  project: "Project",
  broadcast: "Broadcast",
  news: "News",
};
