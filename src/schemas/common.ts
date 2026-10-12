import { z } from "zod";

/** Identifier assigned when a record is stored. */
export const idSchema = z.uuid();

/** ISO-8601 timestamp with an offset, as returned by the API. */
export const timestampSchema = z.iso.datetime();

export const shortTextSchema = z.string().trim().min(1).max(200);

export const longTextSchema = z.string().trim().min(1).max(5000);
