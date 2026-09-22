import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { withSupabaseRetry } from "@/lib/supabase-retry";

const STORAGE_PREFIX = "ecomedic:active_day:";

async function callRecord() {
  // Try RPC first (bypasses PostgREST schema cache issues)
  const rpc = await withSupabaseRetry(
    () => supabase.rpc("record_my_activity"),
    3,
    { kind: "rpc", target: "record_my_activity", action: "record active day" },
  );
  if (!rpc.error) return true;
  // Fallback to direct upsert
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const today = new Date().toISOString().slice(0, 10);
  const upsert = await withSupabaseRetry(
    () => supabase.from("active_days").upsert({ user_id: user.id, day: today }, { onConflict: "user_id,day" }),
    3,
    { kind: "table", target: "active_days", action: "upsert activity" },
  );
  return !upsert.error;
}

async function recordActivity(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${STORAGE_PREFIX}${userId}:${today}`;
  if (typeof window !== "undefined" && window.localStorage.getItem(key) === "1") return;
  const ok = await callRecord();
  if (ok && typeof window !== "undefined") window.localStorage.setItem(key, "1");
}

/**
 * Tracks daily activity on every interaction & route change.
 * Uses an RPC for resilience against PostgREST schema cache 503s.
 */
export function ActivityTracker() {
  const { user } = useAuth();
  const router = useRouter();
  const lastFiredDayRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    const fire = () => {
      const today = new Date().toISOString().slice(0, 10);
      if (lastFiredDayRef.current === today || inFlightRef.current) return;
      inFlightRef.current = true;
      lastFiredDayRef.current = today;
      void recordActivity(userId).finally(() => {
        inFlightRef.current = false;
      });
    };

    fire();

    const unsub = router.subscribe("onResolved", () => fire());

    const onInteract = () => fire();
    const events: (keyof WindowEventMap)[] = [
      "click",
      "pointerdown",
      "touchstart",
      "keydown",
      "scroll",
      "focus",
    ];
    events.forEach((e) => window.addEventListener(e, onInteract, { passive: true }));

    // Heartbeat: re-check every 5 minutes & at midnight crossover
    const heartbeat = window.setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (lastFiredDayRef.current !== today) {
        lastFiredDayRef.current = null;
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(`${STORAGE_PREFIX}${userId}:${today}`);
        }
        fire();
      }
    }, 60_000);

    return () => {
      unsub();
      events.forEach((e) => window.removeEventListener(e, onInteract));
      window.clearInterval(heartbeat);
    };
  }, [user, router]);

  return null;
}
