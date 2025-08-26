// validator.ts
import { z } from 'zod';

/** ---- Schemas (loose enough for your cards, strict on trip_plan) ---- */
const ItinCard = z.object({
  type: z.literal('itinerary'),
  title: z.string(),
  fields: z.object({
    morning: z.string().optional(),
    afternoon: z.string().optional(),
    evening: z.string().optional(),
  }).partial()
});

const Precheck = z.object({
  timezone: z.string(),
  trip_dates: z.object({ start: z.string(), end: z.string() }),
  destinations: z.array(z.any()).min(1),
  ok_to_plan: z.boolean(),
  notes: z.string().optional(),
  derived_dates: z.boolean().optional(),
  assumptions: z.string().optional()
});

export const ResponseSchema = z.object({
  intent: z.enum(['flight_search','hotel_search','car_search','trip_plan','policy_help','general_help']),
  markdown: z.string(),
  precheck: Precheck.optional(),
  cards: z.array(z.any()).optional(),
  cta: z.any().optional(),
  citations: z.any().optional()
});

/** ---- Helpers ---- */
export function inclusiveDayCount(startISO: string, endISO: string) {
  const s = new Date(startISO + 'T00:00:00');
  const e = new Date(endISO + 'T00:00:00');
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

/** Extract the first {...} JSON object if the model added prose */
export function extractFirstJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try { JSON.parse(candidate); return candidate; } catch { return null; }
}

/** Validate + tell if repair is needed (trip_plan rules) */
export function needsRepair(jsonText: string): { ok: boolean; reason?: string; targetDays?: number } {
  let data: any;
  try { data = JSON.parse(jsonText); } catch { return { ok: false, reason: 'not-json' }; }

  const parsed = ResponseSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: 'schema-mismatch' };
  const r = parsed.data;

  if (r.intent !== 'trip_plan') return { ok: true };

  if (!r.precheck) return { ok: false, reason: 'missing-precheck' };
  const { start, end } = r.precheck.trip_dates ?? {};
  if (!start || !end) return { ok: false, reason: 'missing-trip-dates' };
  const n = inclusiveDayCount(start, end);
  if (n < 1 || n > 30) return { ok: false, reason: 'bad-trip-dates' };

  if (r.precheck.ok_to_plan !== true) return { ok: true }; // allowed to withhold itinerary

  const itin = (r.cards ?? []).filter((c: any) => c?.type === 'itinerary');
  if (itin.length !== n) return { ok: false, reason: 'wrong-itin-count', targetDays: n };

  // Optional: ensure each Day i exists in order
  for (let i = 1; i <= n; i++) {
    const title = `Day ${i}`;
    if (!itin.some((c: any) => typeof c.title === 'string' && c.title.startsWith(title))) {
      return { ok: false, reason: 'missing-day-card', targetDays: n };
    }
  }
  return { ok: true };
}

/** Craft a single-shot repair instruction for the model */
export function makeRepairInstruction(reason: string, targetDays?: number) {
  const lines: string[] = [
    "REVISE STRICTLY:",
    "- Output ONLY a single JSON object that matches the Output Contract in the system prompt.",
    "- For intent='trip_plan', include 'precheck' with authoritative citations and 'seen_ist' timestamps.",
    "- If precheck.ok_to_plan=true, include a day-wise itinerary in 'cards'."
  ];
  if (reason === 'not-json' || reason === 'schema-mismatch') {
    lines.push("- Your previous output was not valid JSON. Regenerate as valid JSON only.");
  }
  if (reason === 'missing-precheck' || reason === 'missing-trip-dates') {
    lines.push("- Include 'precheck' with 'trip_dates.start' and 'trip_dates.end' filled (exact or auto-resolved).");
  }
  if (reason === 'bad-trip-dates') {
    lines.push("- Fix 'precheck.trip_dates' to a valid inclusive range (start <= end).");
  }
  if (reason === 'wrong-itin-count' || reason === 'missing-day-card') {
    lines.push(`- Include exactly ${targetDays} itinerary cards titled 'Day 1' … 'Day ${targetDays}'.`);
    lines.push("- Each itinerary card SHOULD include morning/afternoon/evening fields.");
  }
  lines.push("- Do NOT add any prose outside the JSON.");
  return lines.join('\n');
}
