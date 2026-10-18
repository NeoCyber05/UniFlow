import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@clerk/react";

/** Ports proxy.ts: signed-out -> /sign-in; signed-in without an active org -> /select-org. */
export const RequireAuth = () => {
  const { isLoaded, userId, orgId } = useAuth();
  const { pathname } = useLocation();
  if (!isLoaded) return null;
  if (!userId) return <Navigate to="/sign-in" replace />;
  if (!orgId && !pathname.startsWith("/select-org")) return <Navigate to="/select-org" replace />;
  return <Outlet />;
};

/** Signed-in users on "/", "/sign-in", "/sign-up" go to their org or /select-org (proxy.ts: isAuthRoute). */
export const RedirectIfSignedIn = () => {
  const { isLoaded, userId, orgId } = useAuth();
  if (!isLoaded) return null;
  if (!userId) return <Outlet />;
  return <Navigate to={orgId ? `/organization/${orgId}` : "/select-org"} replace />;
};
