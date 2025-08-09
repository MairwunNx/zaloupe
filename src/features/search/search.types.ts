import { ChatType } from "../../shared/database";

export interface NewMessage {
    chat_id: number;
    message_id: number;
    from_id?: number;
    from_username?: string;
    date: Date;
    text?: string;
    chat_type?: ChatType;
}

export interface SearchParams {
  chatId: bigint | number;
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchResultHit {
  id: string;
  rank: number;
  snippet: string;
  date: Date;
  message_id: number;
  from_username?: string;
}

export interface SearchResult {
  total: number;
  hits: SearchResultHit[];
}

