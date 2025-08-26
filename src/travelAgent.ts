import { OpenAI } from 'openai';
import { AgentResponse, ConversationMessage } from './types';
import { systemPrompt } from './prompts';

export class TravelAgent {
  private openai: OpenAI;
  private conversationHistory: ConversationMessage[] = [];
  private destination?: string;
  private duration?: number;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    // Initialize with system prompt
    this.conversationHistory.push({ 
      role: 'system', 
      content: systemPrompt 
    });
  }

  async processMessage(userInput: string): Promise<AgentResponse> {
    // Add user message to history
    this.conversationHistory.push({ 
      role: 'user', 
      content: userInput 
    });

    try {
      // Let GPT-4 handle everything based on the system prompt
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: this.conversationHistory,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const responseContent = completion.choices[0].message.content || '{}';
      const response: AgentResponse = JSON.parse(responseContent);

      // Add assistant response to history
      this.conversationHistory.push({ 
        role: 'assistant', 
        content: responseContent 
      });

      // Extract destination and duration if mentioned (for POC tracking)
      this.extractTripDetails(response);

      return response;

    } catch (error) {
      console.error('Error calling OpenAI:', error);
      
      // Fallback response
      return {
        intent: 'general_help',
        markdown: "I apologize, I'm having trouble processing your request. Could you please try again? I can help with flights, hotels, car rentals, or trip planning."
      };
    }
  }

  private extractTripDetails(response: AgentResponse): void {
    // Simple extraction for POC tracking
    if (response.cards) {
      const hasDestinationOptions = response.cards.some(c => c.type === 'destination_option');
      if (!hasDestinationOptions && response.markdown) {
        // Check if a destination was confirmed
        const cityMatch = response.markdown.match(/(?:to|in|visiting?)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)/);
        if (cityMatch) {
          this.destination = cityMatch[1];
        }
        
        // Check for duration
        const durationMatch = response.markdown.match(/(\\d+)\\s*days?/);
        if (durationMatch) {
          this.duration = parseInt(durationMatch[1]);
        }
      }
    }
  }

  getConversationState(): { destination?: string; duration?: number } {
    return {
      destination: this.destination,
      duration: this.duration
    };
  }

  reset(): void {
    // Clear conversation but keep system prompt
    this.conversationHistory = [
      { role: 'system', content: systemPrompt }
    ];
    this.destination = undefined;
    this.duration = undefined;
  }

  getHistory(): ConversationMessage[] {
    return this.conversationHistory;
  }
}