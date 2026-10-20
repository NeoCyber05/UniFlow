import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/auth-js";

import { toAppUser, type AppUser } from "@/lib/auth/app-user";
import { disableDesktopReminders, reconcileDesktopReminders } from "./desktop-notifications";
import { supabase } from "./supabase";

type AuthState = { isLoaded: boolean; session: Session | null };
const AuthContext = createContext<AuthState>({ isLoaded: false, session: null });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ isLoaded: false, session: null });

  useEffect(() => {
    // A reminder binding of another/no account must not survive a sign-out or account switch (also from another tab).
    const reconcile = (userId: string | null) => void reconcileDesktopReminders(userId).catch(() => {});
    void supabase.auth.getSession().then(({ data }) => {
      setState({ isLoaded: true, session: data.session });
      reconcile(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ isLoaded: true, session });
      reconcile(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const { isLoaded, session } = useContext(AuthContext);
  return { isLoaded, userId: session?.user.id ?? null, session };
};

/** Returns the current auth user state: { isLoaded, user }. */
export const useUser = (): { isLoaded: boolean; user: AppUser | null } => {
  const { isLoaded, session } = useContext(AuthContext);
  const user = useMemo(
    () => (session ? toAppUser({ sub: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata }) : null),
    [session],
  );
  return { isLoaded, user };
};

/** Tắt nhắc nền trước (còn phiên để revoke), rồi mới đăng xuất; lỗi mạng không chặn đăng xuất. */
export const signOut = async () => {
  await disableDesktopReminders().catch(() => {});
  return supabase.auth.signOut();
};
