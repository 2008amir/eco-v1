import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Storage buckets in this project are private, so stored values must be
 * resolved to short-lived signed URLs before they can be rendered.
 * Accepts either a raw object path or a legacy public/signed URL.
 */
export function toStoragePath(bucket: string, value?: string | null): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(new RegExp(`^${bucket}/`), "");
  }
  const match = value.match(new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getStorageUrl(bucket: string, value?: string | null, expiresIn = 3600) {
  if (!value) return null;
  const path = toStoragePath(bucket, value);
  // External URL (e.g. OAuth avatar) — use as-is.
  if (!path) return value;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export function useStorageUrl(bucket: string, value?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setUrl(null);
      return;
    }
    getStorageUrl(bucket, value).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [bucket, value]);

  return url;
}
