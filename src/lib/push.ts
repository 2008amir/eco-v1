import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  "BKokS71SkymulP-xD3OLrMYORaimxOYp8UxQp1B74WcGWJyWgnd-WIEKd8Gwv4zxoYEVLXZuwQjZ39UaTFAQB-Y";

export type PushResult = "on" | "unsupported" | "open-in-new-tab" | "denied" | "error";

export function pushSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}
export function inIframe() {
  try { return window.top !== window.self; } catch { return true; }
}

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
}

/** Must be called from a button press. */
export async function enablePush(userId: string): Promise<PushResult> {
  if (!pushSupported()) return "unsupported";
  if (inIframe()) return "open-in-new-tab";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    localStorage.setItem("push-enabled", "1");
    return "on";
  } catch (e) {
    console.error("enablePush failed", e);
    return "error";
  }
}

export async function disablePush() {
  localStorage.setItem("push-enabled", "0");
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe().catch(() => {});
  }
}

export async function isPushOn() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub) && localStorage.getItem("push-enabled") !== "0";
}

export function pushMessage(r: PushResult) {
  switch (r) {
    case "on": return "Notifications turned on";
    case "unsupported": return "This browser can't show notifications. On iPhone, add the site to your Home Screen first.";
    case "open-in-new-tab": return "Open the site in its own tab to turn on notifications.";
    case "denied": return "Notifications are blocked. Allow them in your browser's site settings.";
    default: return "Couldn't turn on notifications. Please try again.";
  }
}
