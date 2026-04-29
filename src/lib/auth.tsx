import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "cleaner" | "client";
export interface RoleInfo { role: AppRole; cleaner_id: string | null; site_id: string | null }

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: RoleInfo[];
  isAdmin: boolean;
  isCleaner: boolean;
  isClient: boolean;
  cleanerId: string | null;
  clientSiteId: string | null;
  loading: boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | null) => {
    if (!uid) { setRoles([]); return; }
    const { data } = await supabase.from("user_roles").select("role,cleaner_id,site_id").eq("user_id", uid);
    setRoles((data ?? []) as RoleInfo[]);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // defer to avoid deadlock
      setTimeout(() => loadRoles(s?.user?.id ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      loadRoles(data.session?.user?.id ?? null).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.some((r) => r.role === "admin");
  const isCleaner = roles.some((r) => r.role === "cleaner");
  const isClient = roles.some((r) => r.role === "client");
  const cleanerId = roles.find((r) => r.role === "cleaner")?.cleaner_id ?? null;
  const clientSiteId = roles.find((r) => r.role === "client")?.site_id ?? null;

  return (
    <AuthContext.Provider value={{
      session, user, roles, isAdmin, isCleaner, isClient,
      cleanerId, clientSiteId, loading,
      refreshRoles: () => loadRoles(user?.id ?? null),
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
