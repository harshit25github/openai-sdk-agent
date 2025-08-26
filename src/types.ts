export interface AgentResponse {
  intent: 'trip_plan' | 'flight_search' | 'hotel_search' | 'car_search' | 'policy_help' | 'general_help';
  markdown: string;
  cards?: Array<{
    type: string;
    name?: string;
    why?: string;
    title?: string;
    fields?: Record<string, string>;
  }>;
  cta?: {
    label: string;
    options?: string[];
  };
  citations?: string[];
  readyForSearch?: boolean;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}