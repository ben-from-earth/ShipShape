export type UpcomingTool = {
  id: string;
  mono: string;
  name: string;
  source: string;
  description: string;
  color: string;
};

/**
 * Catalog copied from the Tools mockup. Names are unique across the
 * in-house, licensed, and marketplace lists. Nothing here is purchasable yet.
 */
export const UPCOMING_TOOLS: readonly UpcomingTool[] = [
  {
    id: "layer-loads",
    mono: "LL",
    name: "Layer Loads",
    source: "Structures",
    description:
      "Fastener and layer load distribution through multi-layer joints using Huth stiffness.",
    color: "#c8361f",
  },
  {
    id: "lug-analysis",
    mono: "LG",
    name: "Lug Analysis",
    source: "Structures",
    description:
      "Axial, transverse, and oblique lug strength per the classic AFFDL method with bushing checks.",
    color: "#1e2d55",
  },
  {
    id: "doubler-sizer",
    mono: "DS",
    name: "Doubler Sizer",
    source: "Repairs",
    description:
      "Sizes external doublers from damage extent, edge distance, and fastener pattern.",
    color: "#6b4f2a",
  },
  {
    id: "corrosion-blend-out",
    mono: "CB",
    name: "Corrosion Blend-out",
    source: "Repairs",
    description:
      "Checks blend depth and shape against remaining net section and local buckling.",
    color: "#3d4a5c",
  },
  {
    id: "fitting-factor-check",
    mono: "FT",
    name: "Fitting Factor Check",
    source: "Structures",
    description:
      "Applies fitting and bearing factors to attach-fitting margins automatically.",
    color: "#5a3d6b",
  },
  {
    id: "crackgrow-pro",
    mono: "CG",
    name: "CrackGrow Pro",
    source: "Halvorsen Aero",
    description: "Crack growth and spectrum loading.",
    color: "#8a3a2a",
  },
  {
    id: "panel-buckle",
    mono: "PB",
    name: "Panel Buckle",
    source: "Northbridge Eng.",
    description: "Stiffened panel stability with crippling interaction.",
    color: "#1e2d55",
  },
  {
    id: "bonded-joint-studio",
    mono: "BJ",
    name: "Bonded Joint Studio",
    source: "Kestrel Composites",
    description: "Adhesive and composite bonded repairs.",
    color: "#2f5d50",
  },
  {
    id: "fem-bridge",
    mono: "FM",
    name: "FEM Bridge",
    source: "Arcline Software",
    description: "Load extraction from a global finite-element model.",
    color: "#6b4f2a",
  },
  {
    id: "allowables-library",
    mono: "AL",
    name: "Allowables Library",
    source: "Meridian Data",
    description: "Material allowables, A and B basis.",
    color: "#3d4a5c",
  },
  {
    id: "fatigue-spectrum-builder",
    // Mockup tile was "FS". That abbreviation is a station label elsewhere, so the tile uses FB.
    mono: "FB",
    name: "Fatigue Spectrum Builder",
    source: "Halvorsen Aero",
    description:
      "Build and truncate load spectra from duty-cycle or flight data.",
    color: "#8a3a2a",
  },
  {
    id: "shear-clip-rater",
    mono: "SR",
    name: "Shear Clip Rater",
    source: "Tessel Structures",
    description:
      "Clip and angle bracket strength with prying and eccentricity.",
    color: "#1e2d55",
  },
  {
    id: "damage-tolerance-kit",
    mono: "DT",
    name: "Damage Tolerance Kit",
    source: "Ostrava Aerotech",
    description:
      "Residual strength and inspection interval for cracked structure.",
    color: "#3d4a5c",
  },
  {
    id: "truck-frame-checker",
    mono: "TF",
    name: "Truck Frame Checker",
    source: "Ridgeway Defense",
    description:
      "Ladder-frame rail and crossmember checks for ground vehicles.",
    color: "#6b4f2a",
  },
  {
    id: "composite-ply-mapper",
    mono: "CP",
    name: "Composite Ply Mapper",
    source: "Kestrel Composites",
    description: "Ply-by-ply scarf repair layout with stiffness matching.",
    color: "#2f5d50",
  },
  {
    id: "weld-seam-assessor",
    mono: "WS",
    name: "Weld Seam Assessor",
    source: "Ridgeway Defense",
    description: "Fillet and groove weld fatigue classes for steel structure.",
    color: "#5a3d6b",
  },
  {
    id: "report-formatter",
    mono: "RF",
    name: "Report Formatter",
    source: "Arcline Software",
    description:
      "Generates stress report sections from ShipShape analysis records.",
    color: "#15181d",
  },
];
