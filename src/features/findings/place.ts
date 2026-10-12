/**
 * Human text for `issues.location`. The column may be a JSON object,
 * an empty object, or null when the stored value cannot be parsed.
 * Either shape is safe here.
 */
export function locationText(location: unknown): string | null {
  if (
    location == null ||
    typeof location !== "object" ||
    Array.isArray(location)
  ) {
    return null;
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(location)) {
    const text = locationValue(value);
    if (text) {
      parts.push(`${key}: ${text}`);
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function findingZoneLine(zone: string | null | undefined): string {
  const text = zone?.trim() ?? "";
  return text.length > 0 ? text : "—";
}

/** Location label when it is set, otherwise the JSON location, otherwise a dash. */
export function findingLocationLine(input: {
  locationLabel: string | null | undefined;
  location: unknown;
}): string {
  const label = input.locationLabel?.trim() ?? "";
  if (label.length > 0) {
    return label;
  }
  return locationText(input.location) ?? "—";
}

function locationValue(value: unknown): string {
  if (value == null || value === "") {
    return "";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}
