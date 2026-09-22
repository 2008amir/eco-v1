import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_POLICY } from "@/lib/policy";

export type PolicyKey = "form" | "id_card";

export const ID_CARD_DEFAULT_POLICY = "This card is non-transferable and remains the sole property of Ecomedic Squad. It must be displayed prominently during operations. Holder is subject to all operational guidelines and ethical standards. In case of loss, contact administration immediately at +1 (555) 010-4400. Unauthorized use is strictly prohibited. If found, please return to any Ecomedic Squad office or contact human resources. Card Holder must strictly follow all medical protocols and environmental directives.";
const FORM_FALLBACK = ORG_POLICY.map((s) => `${s.heading}\n${s.body}`).join("\n\n");

export function usePolicyText(key: PolicyKey) {
  return useQuery({
    queryKey: ["org-policy", key],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_policies").select("content").eq("key", key).maybeSingle();
      if (error) throw error;
      const content = ((data as { content?: string } | null)?.content ?? "").trim();
      return content.length > 0 ? content : key === "id_card" ? ID_CARD_DEFAULT_POLICY : FORM_FALLBACK;
    },
  });
}
