// multi-agents-stateful.ts
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import {
  Agent,
  Runner,
  run,
  tool,
  user,
  webSearchTool,
  type AgentInputItem
} from '@openai/agents';
import { z } from 'zod';

/* ------------------------------ Tools ------------------------------ */

// Flights (static demo)
const searchFlightsTool = tool({
  name: 'search_flights',
  description: 'Static demo flight results. Use when user asks for flights.',
  parameters: z.object({
    from: z.string().min(3).describe('Origin city or IATA (e.g., DEL)'),
    to: z.string().min(3).describe('Destination city or IATA (e.g., CCU)'),
    depart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD'),
    ret: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null)
      .describe('Return date YYYY-MM-DD, or null for one-way'),
    adults: z.number().int().positive().default(1)
  }),
  async execute({ from, to, depart, ret, adults }) {
    return {
      currency: 'INR',
      search: { from, to, depart, ret, adults },
      results: [
        { id: 'AF225', carrier: 'Air France', from, to, depart: `${depart}T09:25+05:30`, arrive: `${depart}T18:45+01:00`, stops: 1, duration: '12h 50m', fare: 58900 },
        { id: 'LH761', carrier: 'Lufthansa', from, to, depart: `${depart}T02:50+05:30`, arrive: `${depart}T12:35+01:00`, stops: 1, duration: '12h 15m', fare: 61250 }
      ],
      note: 'Static demo — replace with real API later.'
    };
  }
});

// Cars (static demo)
const searchCarsTool = tool({
  name: 'search_cars',
  description: 'Static demo car rental results. Use when user asks for a car.',
  parameters: z.object({
    city: z.string().min(2),
    pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dropoff_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }),
  async execute({ city, pickup_date, dropoff_date }) {
    return {
      currency: 'INR',
      city, pickup_date, dropoff_date,
      results: [
        { id: 'CAR-ECON', brand: 'Toyota', model: 'Yaris', class: 'Economy', pricePerDay: 2100 },
        { id: 'CAR-SUV', brand: 'Hyundai', model: 'Creta', class: 'SUV', pricePerDay: 3900 }
      ],
      note: 'Static demo — replace with real API later.'
    };
  }
});

/* ------------------------------ Agents ----------------------------- */

// Trip Planner with hosted web search precheck + day-wise itinerary (5-day fallback)
const tripPlannerAgent = new Agent({
  name: 'Trip Planner Agent',
  model: 'gpt-4.1-mini',
  tools: [
    // Use hosted web search to gather: weather snapshot, travel advisory, political/unrest signals.
    webSearchTool()
  ],
  instructions: `
You are a concise trip-planning assistant.

PHASE 1 — City choice:
- If the user gives only a region (e.g., "east part of India"), do NOT guess one city.
  Suggest 4–6 specific cities with a one-line "why" each (e.g., Kolkata — heritage & food; Darjeeling — views & tea estates; Gangtok — monasteries & mountain drives; Puri — beach & Jagannath Temple; Shillong — waterfalls & cafes). Then stop.

PHASE 2 — Precheck + Itinerary:
- Once a specific city is known, do a quick "Precheck" using the web search tool for:
  1) Weather snapshot/forecast window around the user's dates (or inferred dates),
  2) Travel advisory/safety note,
  3) Recent political or civic unrest (strikes, protests) if any.
  Cite 1–2 links briefly (titles or domains are fine).
- If dates are vague (e.g., "next month", "this weekend"), you MAY infer a reasonable date window and state assumptions in one line.
  * If user didn't specify a day count, DEFAULT to a **5-day** trip.
- After the precheck, produce a short **day-wise plan**:
  "Day 1 … Day N" with 1–2 bullets per day (morning/afternoon/evening optional).
- Keep it brief and readable (no strict JSON needed for this demo).
- Do NOT book or call flight/car tools here. If they ask for flights or cars, the gateway will route to the right agent.
`
});

// Flight Search Agent — requires from/to, date fallback: +1 month, 5-day return
const flightSearchAgent = new Agent({
  name: 'Flight Search Agent',
  model: 'gpt-4.1-mini',
  tools: [searchFlightsTool],
  instructions: `
You help users find flights. Be compact and practical.

REQUIRED FIELDS:
- Origin (from) and Destination (to) are MANDATORY; if either is missing, ask for it first.
- If depart date is missing, pick a default: exactly **one month from today** (YYYY-MM-DD).
- If return date is not provided, assume a **5-day** trip (return = depart + 4 days). If user says "one-way", set return = null.

FLOW:
- Confirm or infer the dates (state assumptions briefly).
- Call the search_flights tool with from, to, depart, ret (nullable), adults (default 1).
- Summarize 1–2 options with fare & duration and ask if they want to refine.
`
});

// Car Search Agent — unchanged (kept simple)
const carSearchAgent = new Agent({
  name: 'Car Search Agent',
  model: 'gpt-4.1-mini',
  tools: [searchCarsTool],
  instructions: `
You help users find rental cars. Keep it compact.

REQUIRED:
- Need city, pickup_date, dropoff_date (YYYY-MM-DD). If dates are vague, infer a Fri–Sun window for "this weekend" and state assumption.
- Call search_cars and summarize 1–2 options with price per day.
`
});

// Gateway with continuity
const gatewayAgent = Agent.create({
  name: 'Gateway Agent',
  model: 'gpt-4.1-mini',
  instructions: `
You route messages to the right agent and maintain continuity.

ROUTING:
- Trip/itinerary planning, destinations, "plan N days in X" -> Trip Planner Agent.
- Flights, airfare, "find flights", "DEL to CCU", "book plane" -> Flight Search Agent.
- Cars, rentals, "need a car", "pickup/dropoff dates" -> Car Search Agent.

CONTINUITY:
- If the previous assistant turn came from one of the downstream agents and the user is providing related follow-up (even partial),
  keep the handoff to the **same** agent rather than switching.

If unclear, ask one brief clarifying question or pick Trip Planner if it's clearly travel but vague.
`,
  handoffs: [tripPlannerAgent, flightSearchAgent, carSearchAgent],
});

/* ------------------------------ Stateful CLI ------------------------ */

const HISTORY_PATH = path.resolve('thread.json');
const runner = new Runner({ workflowName: 'multi-agents-stateful' });
let thread: AgentInputItem[] = [];

async function loadThread() {
  try {
    thread = JSON.parse(await fs.readFile(HISTORY_PATH, 'utf8'));
    console.log(`(loaded ${thread.length} items from ${HISTORY_PATH})`);
  } catch { thread = []; }
}
async function saveThread() {
  await fs.writeFile(HISTORY_PATH, JSON.stringify(thread, null, 2), 'utf8');
}

async function main() {
  await loadThread();
  const rl = readline.createInterface({ input, output });
  console.log('Multi-Agent Travel Demo — type "exit" to quit. Commands: /reset /save /load');

  process.on('SIGINT', async () => {
    console.log('\n(^C) Saving session…');
    await saveThread(); rl.close(); process.exit(0);
  });

  while (true) {
    const q = (await rl.question('you> ')).trim();
    if (!q) continue;
    if (q.toLowerCase() === 'exit') break;
    if (q === '/reset') { thread = []; await saveThread(); console.log('(history reset)'); continue; }
    if (q === '/save')  { await saveThread(); console.log(`(saved to ${HISTORY_PATH})`); continue; }
    if (q === '/load')  { await loadThread(); continue; }

    // Run with full history
    const res = await runner.run(gatewayAgent, thread.concat(user(q)));

    // Persist authoritative history from the SDK
    thread = res.history;

    console.log(`\n[last agent]: ${res.lastAgent?.name ?? 'Gateway Agent'}`);
    if (Array.isArray(res.finalOutput)) {
      console.log(res.finalOutput.map(String).join('\n'));
    } else {
      console.log(String(res.finalOutput ?? ''));
    }
    console.log();

    await saveThread();
  }

  await saveThread();
  rl.close();
  console.log('Session ended. Bye!');
}

main().catch(async (err) => {
  console.error(err);
  await saveThread();
  process.exit(1);
});
