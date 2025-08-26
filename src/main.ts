import * as readline from 'readline';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { TravelAgent } from './travelAgent';
import { WebSearchTool } from './tools';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.blue('You: ')
});

async function main() {
  console.log(chalk.cyan('\\n🏖️  Welcome to CheapoAir Travel Assistant POC!'));
  console.log(chalk.gray('Ask me to plan a trip! (type "exit" to quit, "reset" to start over)\\n'));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: OPENAI_API_KEY not found in .env file'));
    process.exit(1);
  }

  const agent = new TravelAgent(apiKey);
  const webSearch = new WebSearchTool();

  const askQuestion = () => {
    rl.prompt();
  };

  rl.on('line', async (input) => {
    const trimmedInput = input.trim();
    
    if (trimmedInput.toLowerCase() === 'exit') {
      console.log(chalk.green('\\nThanks for using CheapoAir! Safe travels! 🌟'));
      rl.close();
      return;
    }

    if (trimmedInput.toLowerCase() === 'reset') {
      agent.reset();
      console.log(chalk.cyan('\\nConversation reset. Let\\"s start fresh!\\n'));
      askQuestion();
      return;
    }

    if (trimmedInput === '') {
      askQuestion();
      return;
    }

    try {
      console.log(chalk.gray('\\nThinking...'));
      
      // Get response from agent
      const response = await agent.processMessage(trimmedInput);
      
      // Display the response
      console.log(chalk.green('\\nAssistant:'));
      console.log(response.markdown);
      
      // If cards exist, display them nicely
      if (response.cards && response.cards.length > 0) {
        console.log('');
        response.cards.forEach((card, index) => {
          if (card.type === 'destination_option') {
            console.log(chalk.yellow('  ' + (index + 1) + '. ' + card.name) + chalk.gray(' - ' + card.why));
          } else if (card.type === 'itinerary') {
            console.log(chalk.yellow('\\n' + card.title + ':'));
            if (card.fields) {
              Object.entries(card.fields).forEach(([key, value]) => {
                console.log('  • ' + key + ': ' + value);
              });
            }
          }
        });
      }
      
      // Show CTA if present
      if (response.cta) {
        console.log(chalk.cyan('\\n[' + response.cta.label + ']'));
      }
      
      // Check if ready for web search
      if (response.readyForSearch) {
        console.log(chalk.magenta('\\n🔍 Ready for web search! Fetching real-time data...'));
        const state = agent.getConversationState();
        if (state.destination) {
          await webSearch.searchTravelData(state.destination);
        }
        console.log(chalk.magenta('📝 [Next: Generate detailed itinerary with real data]'));
      }
      
      console.log(''); // Empty line for spacing
      askQuestion();
      
    } catch (error) {
      console.error(chalk.red('\\nError:', error));
      askQuestion();
    }
  });

  // Start the conversation
  askQuestion();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\\n\\nGoodbye! 👋'));
  process.exit(0);
});

main().catch(console.error);