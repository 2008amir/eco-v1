import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { withSupabaseRetry, refreshSupabaseSession } from "@/lib/supabase-retry";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  country: string;
  phone: string | null;
  avatar_url: string | null;
  middle_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  city?: string | null;
  state?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  home_number?: string | null;
  home_email?: string | null;
  institution?: string | null;
  course_of_study?: string | null;
  program_of_study?: string | null;
  is_graduate?: boolean | null;
  graduation_year?: string | null;
  school_level?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_address?: string | null;
  guardian_relationship?: string | null;
  emergency_name?: string | null;
  emergency_relationship?: string | null;
  emergency_phone?: string | null;
  id_full_name?: string | null;
  blood_group?: string | null;
  id_phone?: string | null;
  signature_data?: string | null;
  position_id?: string | null;
  member_no?: string | null;
  onboarding_step?: number | null;
  policy_accepted_at?: string | null;
  registered_at?: string | null;
  is_revoked?: boolean | null;
  account_status?: string | null;
  position_pending?: boolean | null;
  pending_position_id?: string | null;
};


type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  rolesLoaded: boolean;
  rolesError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ROLE_RETRY_DELAYS = [120, 280];
async function loadAuthStateRequest() {
  return withSupabaseRetry(
    () => supabase.rpc("get_my_auth_state").single(),
    2,
    { kind: "rpc", target: "get_my_auth_state", action: "load auth state" },
  );
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const initializedRef = useRef(false);

  const loadAuthStateWithRetry = async (requestId: number, currentUser: User, attempt = 0): Promise<void> => {
    const authStateResult = await loadAuthStateRequest();

    if (loadRequestRef.current !== requestId) return;
    if (authStateResult.error && attempt < ROLE_RETRY_DELAYS.length) {
      await new Promise((r) => setTimeout(r, ROLE_RETRY_DELAYS[attempt]));
      return loadAuthStateWithRetry(requestId, currentUser, attempt + 1);
    }
    if (authStateResult.error) {
      setProfile(null);
      setIsAdmin(false);
      setRolesError("Could not check your registration. Please retry.");
      setRolesLoaded(true);
      return;
    }

    const row = authStateResult.data as { profile: Profile | null; is_admin: boolean | null } | null;
    setProfile(row?.profile ?? null);
    setIsAdmin(Boolean(row?.is_admin));
    setRolesError(row?.profile || row?.is_admin ? null : "Could not find your registration. Please retry.");
    setRolesLoaded(true);
  };

  const loadUserData = async (currentUser: User) => {
    const requestId = ++loadRequestRef.current;
    setRolesLoaded(false);
    setRolesError(null);
    setProfile(null);
    setIsAdmin(false);
    await loadAuthStateWithRetry(requestId, currentUser);
  };

  useEffect(() => {
    const applySession = (sess: Session | null, event?: AuthChangeEvent) => {
      if (event === "INITIAL_SESSION" && initializedRef.current) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setRolesLoaded(false);
        setRolesError(null);
        void loadUserData(sess.user);
      } else {
        loadRequestRef.current += 1;
        setProfile(null);
        setIsAdmin(false);
        setRolesError(null);
        setRolesLoaded(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "INITIAL_SESSION") return;
      applySession(sess, event);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      initializedRef.current = true;
      applySession(sess);
      if (!sess?.user) setRolesLoaded(true);
      setLoading(false);
    });

    // Access tokens expire while a tab sits idle; make sure we hold a fresh one
    // whenever the tab becomes visible again, otherwise every query 401s.
    const ensureFreshSession = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const { data } = await supabase.auth.getSession();
      const expiresAt = data.session?.expires_at ?? 0;
      if (!data.session) return;
      if (expiresAt * 1000 - Date.now() < 60_000) await refreshSupabaseSession();
    };

    const onVisible = () => void ensureFreshSession();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onVisible);
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onVisible);
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadUserData(user);
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "global" });
    loadRequestRef.current += 1;
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setRolesError(null);
    setRolesLoaded(true);
    setLoading(false);
    if (typeof window !== "undefined") window.location.assign("/");
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, rolesLoaded, rolesError, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
