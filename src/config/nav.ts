import { DEMO_ASSET_GROUP_NAME } from "@/config/demo";

export const APP_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Findings", href: "/findings" },
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

/** Current group name. Demo data until a selected asset group exists. */
const currentGroup: Crumb = {
  label: DEMO_ASSET_GROUP_NAME,
  href: "/dashboard",
};

/**
 * Breadcrumbs use domain terms: "Asset group", then the current group's
 * name, then the section. The name comes from demo data.
 */
export function crumbsForPath(pathname: string): Crumb[] {
  if (pathname === "/engineering" || pathname.startsWith("/engineering/")) {
    return [assetGroup, currentGroup, { label: "Engineering" }];
  }

  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return [assetGroup, currentGroup, { label: "Docs" }];
  }

  if (pathname === "/tools" || pathname.startsWith("/tools/")) {
    return [assetGroup, currentGroup, { label: "Tools" }];
  }

  if (pathname === "/findings/new") {
    return [
      assetGroup,
      currentGroup,
      { label: "Findings", href: "/findings" },
      { label: "New finding" },
    ];
  }

  if (pathname === "/findings") {
    return [assetGroup, currentGroup, { label: "Findings" }];
  }

  if (pathname.startsWith("/findings/")) {
    return [
      assetGroup,
      currentGroup,
      { label: "Findings", href: "/findings" },
      { label: "Finding" },
    ];
  }

  return [assetGroup, { label: DEMO_ASSET_GROUP_NAME }];
}

export function isNavActive(pathname: string, href: AppHref): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
