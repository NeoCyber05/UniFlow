import { Navigate, Outlet } from "react-router";

import { useAuth } from "../lib/auth";
import { getStartPath } from "../lib/local-prefs";

/** Signed-out users go to /sign-in. */
export const RequireAuth = () => {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return null;
  return userId ? <Outlet /> : <Navigate to="/sign-in" replace />;
};

/** Signed-in users on "/", "/sign-in", "/sign-up" go to their chosen start screen. */
export const RedirectIfSignedIn = () => {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return null;
  return userId ? <Navigate to={getStartPath()} replace /> : <Outlet />;
};
