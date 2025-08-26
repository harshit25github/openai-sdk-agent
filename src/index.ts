import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import OpenAI from 'openai';
import { search_flights_cheapoair, search_hotels_cheapoair, search_cars_cheapoair } from './tools';


import {
  Agent,
  Runner,
  user,
  extractAllTextOutput,
  OpenAIResponsesModel,
  setDefaultOpenAIClient,
  webSearchTool,
  type AgentInputItem,
} from '@openai/agents';

import { systemPrompt } from './prompts'; // your existing prompt with PRECHECK rules
import { systemPromptUpdated } from './prompt2';

const MODEL = 'gpt-4.1-mini';
const HISTORY_PATH = path.resolve('thread.json');

const agent = new Agent({
  name: 'CheapoAir Travel Assistant',
  instructions: systemPromptUpdated,
   model: MODEL,
  tools: [webSearchTool(), search_flights_cheapoair, search_hotels_cheapoair, search_cars_cheapoair],                            // Hosted Web Search
});

const runner = new Runner({ workflowName: 'cli-travel-chat' });

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
  console.log('CheapoAir CLI — type "exit" to quit. Commands: /reset /save /load');

  process.on('SIGINT', async () => {
    console.log('\n(^C) Saving session…');
    await saveThread();
    rl.close();
    process.exit(0);
  });

  while (true) {
    const text = (await rl.question('you> ')).trim();
    if (!text) continue;
    if (text.toLowerCase() === 'exit') break;

    if (text === '/reset') { thread = []; await saveThread(); console.log('(history reset)'); continue; }
    if (text === '/save')  { await saveThread(); console.log(`(saved to ${HISTORY_PATH})`); continue; }
    if (text === '/load')  { await loadThread(); continue; }

    // IMPORTANT: pass an array of items (thread + new user message)
    const result = await runner.run(agent, thread.concat(user(text)));

    // Always replace local thread with the authoritative history
    thread = result.history;

    // Print assistant output (handles multi-block responses)
    const finalText = result.finalOutput ?? extractAllTextOutput(result.newItems);
    console.log('assistant>', finalText);
    // for (const t of finalText) console.log(`assistant> ${t}`);

    // Optional: surface any URL citations (from hosted web search)
   for (const item of result.output ?? []) {
  if (item.type !== 'message') continue;
  for (const block of item.content ?? []) {
    if (typeof block === 'string') continue;               // <-- strings have no .type
    if (block.type === 'output_text') {  
        //@ts-ignore                  // <-- safe: now a typed block
      for (const ann of block.annotations ?? []) {
        if (ann.type === 'url_citation') {
          console.log(`source> ${ann.title ?? ann.url} — ${ann.url}`);
        }
      }
    }
  }
}

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
