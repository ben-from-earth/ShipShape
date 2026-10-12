import "server-only";

import { io } from "next/cache";

import { DEMO_AS_OF } from "@/config/demo";
import { isoDateUtc } from "@/lib/dates";

/**
 * One clock read for a request. Dashboard and analyses both call this
 * after `io()`, so prerender does not bake the day into the static shell.
 * With no `DATABASE_URL` the day is the fixture date.
 */
export async function readRequestClock(): Promise<{
  now: Date;
  asOf: string;
}> {
  await io();

  if (!process.env.DATABASE_URL) {
    return {
      now: new Date(`${DEMO_AS_OF}T00:00:00.000Z`),
      asOf: DEMO_AS_OF,
    };
  }

  const now = new Date();
  return { now, asOf: isoDateUtc(now) };
}
