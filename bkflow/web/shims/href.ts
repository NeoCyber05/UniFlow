export type Href = string | { pathname?: string; query?: Record<string, string> };

export const toHref = (href: Href) =>
  typeof href === "string"
    ? href
    : `${href.pathname ?? ""}${href.query ? `?${new URLSearchParams(href.query)}` : ""}`;
