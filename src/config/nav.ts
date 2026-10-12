export const APP_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Engineering", href: "/engineering" },
  { label: "Docs", href: "/docs" },
  { label: "Tools", href: "/tools" },
] as const;

export type AppHref = (typeof APP_NAV)[number]["href"];

export type Crumb = {
  label: string;
  href?: AppHref;
};

const assetGroup: Crumb = { label: "Asset group", href: "/dashboard" };
const asset: Crumb = { label: "Asset", href: "/dashboard" };

/**
 * Breadcrumbs stay domain-agnostic: "Asset group / Asset", never a
 * vehicle-specific taxonomy. T-45 and similar names belong in demo
 * content, not in these labels.
 */
export function crumbsForPath(pathname: string): Crumb[] {
  if (pathname === "/engineering" || pathname.startsWith("/engineering/")) {
    return [assetGroup, asset, { label: "Engineering" }];
  }

  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return [assetGroup, asset, { label: "Docs" }];
  }

  if (pathname === "/tools" || pathname.startsWith("/tools/")) {
    return [assetGroup, asset, { label: "Tools" }];
  }

  return [assetGroup, { label: "Asset" }];
}

export function isNavActive(pathname: string, href: AppHref): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
