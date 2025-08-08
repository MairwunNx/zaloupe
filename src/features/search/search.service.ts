import { Client } from "@elastic/elasticsearch";
import { ELASTIC_INDEX, ELASTIC_PASSWORD, ELASTIC_URL, ELASTIC_USERNAME } from "./search.env";
import { IndexedMessage, SearchParams, SearchResult } from "./search.types";
import { logError, logInfo } from "../../shared/logging";

function createElasticClient(): Client {
  const auth = ELASTIC_USERNAME && ELASTIC_PASSWORD ? { username: ELASTIC_USERNAME, password: ELASTIC_PASSWORD } : undefined;
  return new Client({ node: ELASTIC_URL, auth });
}

const client = createElasticClient();

export async function ensureIndex(): Promise<void> {
  try {
    const exists = await client.indices.exists({ index: ELASTIC_INDEX });
    if (!exists) {
      try {
        await client.indices.create({
          index: ELASTIC_INDEX,
          settings: {
            analysis: {
              analyzer: {
                ru_search: {
                  type: "custom",
                  tokenizer: "standard",
                  filter: ["lowercase", "russian_stop", "russian_stemmer"],
                },
              },
              filter: {
                russian_stop: { type: "stop", stopwords: "_russian_" },
                russian_stemmer: { type: "stemmer", language: "russian" },
              },
            },
          },
          mappings: {
            properties: {
              chat_id: { type: "keyword" },
              message_id: { type: "long" },
              date: { type: "date" },
              text: { type: "text", analyzer: "ru_search", term_vector: "with_positions_offsets" },
              text_trimmed: { type: "text", analyzer: "ru_search" },
              entities: { type: "nested" },
              attachments: { type: "nested" },
              lang: { type: "keyword" },
              chat_type: { type: "keyword" },
            },
          },
        });
        logInfo(`Создан индекс Elasticsearch: ${ELASTIC_INDEX}`);
      } catch (err: any) {
        const type = err?.meta?.body?.error?.type;
        if (type !== 'resource_already_exists_exception') throw err;
        logInfo(`Индекс уже существует: ${ELASTIC_INDEX}`);
      }
    }
  } catch (e) {
    logError(`Ошибка ensureIndex:`, e);
  }
}

export async function indexMessage(doc: IndexedMessage): Promise<void> {
  try {
    await client.index({
      index: ELASTIC_INDEX,
      id: `${doc.chat_id}:${doc.message_id}`,
      document: doc,
      refresh: "wait_for", // Ждем обновления индекса для немедленного поиска
    });
    logInfo(`Сообщение ${doc.chat_id}:${doc.message_id} проиндексировано в Elasticsearch`);
  } catch (e) {
    logError(`Ошибка индексации в Elasticsearch:`, e);
    throw e; // Перебрасываем ошибку для retry механизма
  }
}

export async function searchMessages(params: SearchParams): Promise<SearchResult> {
  const { chatId, query, limit = 5, offset = 0 } = params;
  try {
    logInfo(`Поиск в чате ${chatId}`);

    const res = await client.search<IndexedMessage>({
      index: ELASTIC_INDEX,
      size: Math.min(limit, 25),
      from: Math.max(0, offset),
      track_total_hits: true,
      query: {
        bool: {
          must: [{
            simple_query_string: {
              query,
              fields: ["text^2", "text_trimmed"],
              default_operator: "and",
            },
          }],
          filter: [{ term: { chat_id: String(chatId) } }],
        },
      },
      highlight: {
        fields: {
          text: {
            type: "unified",
            fragment_size: 120,
            number_of_fragments: 1,
            pre_tags: [""],
            post_tags: [""],
          },
        },
      },
    });

    const total = typeof res.hits.total === 'number'
      ? res.hits.total
      : (res.hits.total?.value ?? 0);

    const hits = res.hits.hits.map(h => ({
      id: String(h._id),
      score: h._score ?? undefined,
      doc: h._source!,
    }));

    logInfo(`Найдено ${total} результатов для запроса в чате ${chatId}`);
    return { total, hits };
  } catch (e) {
    logError(`Ошибка поиска в Elasticsearch:`, e);
    throw e; // Перебрасываем ошибку для обработки на уровне выше
  }
}
