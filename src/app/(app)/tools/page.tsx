import type { Metadata } from "next";

import { ToolCatalog } from "@/components/tools/tool-catalog";
import { UPCOMING_TOOLS } from "@/config/tools";

export const metadata: Metadata = {
  title: "Tools",
};

export default function ToolsPage() {
  return <ToolCatalog tools={UPCOMING_TOOLS} />;
}
