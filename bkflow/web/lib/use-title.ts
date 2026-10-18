import { useEffect } from "react";

import { siteConfig } from "@/config/site";

export const useTitle = (title?: string) => {
  useEffect(() => {
    document.title = title ? `${title} | ${siteConfig.name}` : siteConfig.name;
  }, [title]);
};
