import {Agent,webSearchTool,run} from '@openai/agents';
import 'dotenv/config';
import fs from 'fs';
import { systemPrompt } from './prompts';
// import { run } from 'node:test';

const agent = new Agent({
  name: 'Travel assistant',
  instructions: systemPrompt,
  tools: [webSearchTool()],
});


async function ChatWithAgent(message: string){
    const result  = await run(agent,message);
    console.log(result.history)
    fs.writeFileSync('history.txt',JSON.stringify(result.history,null,2));
    fs.writeFileSync('finalOutput.txt',JSON.stringify(result.output,null,2));
    console.log(result.finalOutput);

}

ChatWithAgent(" I want to plan a trip to Paris for 5 days in December. Can you help me with that?");

