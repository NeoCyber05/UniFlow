export type PageSummary = { id: string; title: string; parentId: string | null; updatedAt: string; icon?: string | null; isFavorite?: boolean; deletedAt?: string | null };
export type PageNode = PageSummary & { children: PageNode[] };

// Pages whose parent is missing from the list (older than the fetched window) are shown at the root.
export const buildPageTree = (pages: PageSummary[]): PageNode[] => {
  const nodes = new Map(pages.map(page => [page.id, { ...page, children: [] as PageNode[] }]));
  const roots: PageNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent && parent !== node ? parent.children : roots).push(node);
  }
  return roots;
};

// Ancestors from root to the page itself; stops on cycles or missing parents.
export const getPagePath = (pages: PageSummary[], id: string): PageSummary[] => {
  const byId = new Map(pages.map(page => [page.id, page]));
  const path: PageSummary[] = [];
  for (let page = byId.get(id); page && !path.includes(page); page = page.parentId ? byId.get(page.parentId) : undefined) path.unshift(page);
  return path;
};

// The page itself plus every descendant, cycle-safe.
export const getSubtreeIds = (pages: { id: string; parentId: string | null }[], id: string): string[] => {
  const ids = [id];
  for (let index = 0; index < ids.length; index++) {
    for (const page of pages) if (page.parentId === ids[index] && !ids.includes(page.id)) ids.push(page.id);
  }
  return ids;
};
