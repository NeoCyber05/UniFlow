/* eslint-disable @typescript-eslint/no-unused-vars -- Next API parity: accepted-but-ignored args */
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link as RRLink } from "react-router";

import { toHref, type Href } from "./href";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href;
  replace?: boolean;
  prefetch?: boolean | null;
  scroll?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(({ href, prefetch: _p, scroll: _s, ...rest }, ref) => {
  const to = toHref(href);
  return /^https?:\/\//.test(to) ? <a ref={ref} href={to} {...rest} /> : <RRLink ref={ref} to={to} {...rest} />;
});
Link.displayName = "Link";

export default Link;
