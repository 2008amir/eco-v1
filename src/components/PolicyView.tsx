import { ORG_POLICY_TITLE } from "@/lib/policy";
import { usePolicyText } from "@/lib/org-policy";

export function PolicyView() {
  const { data: text, isLoading } = usePolicyText("form");
  const paragraphs = (text ?? "").split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return (
    <div className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
      <h2 className="text-lg font-semibold gradient-text">{ORG_POLICY_TITLE}</h2>
      {isLoading && <div className="h-32 rounded-lg bg-muted/30 animate-pulse" />}
      {paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{p}</p>
      ))}
    </div>
  );
}
