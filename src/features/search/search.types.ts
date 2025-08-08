export interface IndexedMessage {
  chat_id: string;
  message_id: number;
  from_id?: string;
  from_username?: string | null;
  date: string;
  text?: string;
  entities?: unknown[];
  attachments?: unknown[];
  lang?: string;
  chat_type?: string;
}

export interface SearchHitDoc extends IndexedMessage {}

export interface SearchHit {
  id: string;
  score?: number;
  doc: SearchHitDoc;
}

export interface SearchParams {
  chatId: bigint | number | string;
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  total: number;
  hits: SearchHit[];
}
