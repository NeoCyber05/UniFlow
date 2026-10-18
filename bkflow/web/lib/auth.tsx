import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { toAppUser, type AppUser } from "@/lib/auth/app-user";
import { supabase } from "./supabase";

type AuthState = { isLoaded: boolean; session: Session | null };
const AuthContext = createContext<AuthState>({ isLoaded: false, session: null });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ isLoaded: false, session: null });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setState({ isLoaded: true, session: data.session }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ isLoaded: true, session }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const { isLoaded, session } = useContext(AuthContext);
  return { isLoaded, userId: session?.user.id ?? null, session };
};

/** Same shape the UI used from Clerk's useUser(): { isLoaded, user }. */
export const useUser = (): { isLoaded: boolean; user: AppUser | null } => {
  const { isLoaded, session } = useContext(AuthContext);
  const user = useMemo(
    () => (session ? toAppUser({ sub: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata }) : null),
    [session],
  );
  return { isLoaded, user };
};

export const signOut = () => supabase.auth.signOut();
