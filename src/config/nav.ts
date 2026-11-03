import { DEMO_ASSET_GROUP_NAME } from "@/config/demo";

export const APP_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Issues", href: "/issues" },
  { label: "Repairs", href: "/repairs" },
  { label: "Analyses", href: "/analyses" },
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
    return [assetGroup, currentGroup, { label: "Analyses", href: "/analyses" }];
  }

  if (pathname === "/analyses") {
    return [assetGroup, currentGroup, { label: "Analyses" }];
  }

  if (pathname.startsWith("/analyses/")) {
    return [
      assetGroup,
      currentGroup,
      { label: "Analyses", href: "/analyses" },
      { label: "Analysis" },
    ];
  }

  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return [assetGroup, currentGroup, { label: "Docs" }];
  }

  if (pathname === "/tools" || pathname.startsWith("/tools/")) {
    return [assetGroup, currentGroup, { label: "Tools" }];
  }

  if (isIssueNew(pathname)) {
    return [
      assetGroup,
      currentGroup,
      { label: "Issues", href: "/issues" },
      { label: "New issue" },
    ];
  }

  if (isIssueList(pathname)) {
    return [assetGroup, currentGroup, { label: "Issues" }];
  }

  if (isIssueDetail(pathname)) {
    return [
      assetGroup,
      currentGroup,
      { label: "Issues", href: "/issues" },
      { label: "Issue" },
    ];
  }

  if (pathname === "/repairs") {
    return [assetGroup, currentGroup, { label: "Repairs" }];
  }

  if (pathname.startsWith("/repairs/")) {
    return [
      assetGroup,
      currentGroup,
      { label: "Repairs", href: "/repairs" },
      { label: "Repair" },
    ];
  }

  return [assetGroup, { label: DEMO_ASSET_GROUP_NAME }];
}

export function isNavActive(pathname: string, href: AppHref): boolean {
  if (href === "/issues") {
    return (
      pathname === "/issues" ||
      pathname.startsWith("/issues/") ||
      pathname === "/findings" ||
      pathname.startsWith("/findings/")
    );
  }
  if (href === "/analyses") {
    return (
      pathname === "/analyses" ||
      pathname.startsWith("/analyses/") ||
      pathname === "/engineering" ||
      pathname.startsWith("/engineering/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isIssueNew(pathname: string): boolean {
  return pathname === "/issues/new" || pathname === "/findings/new";
}

function isIssueList(pathname: string): boolean {
  return pathname === "/issues" || pathname === "/findings";
}

function isIssueDetail(pathname: string): boolean {
  return (
    (pathname.startsWith("/issues/") && pathname !== "/issues/new") ||
    (pathname.startsWith("/findings/") && pathname !== "/findings/new")
  );
}
