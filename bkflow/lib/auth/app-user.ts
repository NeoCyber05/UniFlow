export type AppUser = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  username: string | null;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string } | null;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
};

export type AuthClaims = {
  sub: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string };
};

export const toAppUser = (claims: AuthClaims): AppUser => {
  const meta = claims.user_metadata ?? {};
  const local = claims.email?.split("@")[0] ?? "";
  const fullName = (meta.full_name || meta.name || local).trim();
  const [firstName = "", ...rest] = fullName.split(/\s+/).filter(Boolean);
  const emailAddresses = claims.email ? [{ id: `email_${claims.sub}`, emailAddress: claims.email }] : [];

  return {
    id: claims.sub,
    fullName,
    firstName,
    lastName: rest.join(" "),
    username: local || null,
    imageUrl: meta.avatar_url || meta.picture || "",
    primaryEmailAddress: emailAddresses[0] ? { emailAddress: emailAddresses[0].emailAddress } : null,
    primaryEmailAddressId: emailAddresses[0]?.id ?? null,
    emailAddresses,
  };
};
