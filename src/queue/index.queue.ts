import { Queue, Worker, JobsOptions } from "bullmq";
import { getRedis } from "./redis";
import { indexMessage } from "../features/search/search.service";
import { IndexedMessage } from "../features/search/search.types";
import { logError, logSuccess, logInfo } from "../shared/logging";

const connection = getRedis();
export const INDEX_QUEUE_NAME = "index-messages" as const;

export const indexQueue = new Queue(INDEX_QUEUE_NAME, { connection });

export type IndexJobData = { doc: IndexedMessage };

export function startIndexWorker(concurrency = Number(process.env.INDEX_CONCURRENCY || 4)) {
  const processor = async (job: { data: IndexJobData }) => {
    try {
      logInfo(`Индексирую сообщение ${job.data.doc.chat_id}:${job.data.doc.message_id}`);
      await indexMessage(job.data.doc);
      logSuccess(`Сообщение ${job.data.doc.chat_id}:${job.data.doc.message_id} успешно проиндексировано`);
    } catch (error) {
      logError(`Ошибка индексации сообщения ${job.data.doc.chat_id}:${job.data.doc.message_id}: ${(error as Error).message}`);
      throw error; // Перебрасываем ошибку для retry механизма
    }
  };

  const worker = new Worker(INDEX_QUEUE_NAME, processor as any, {
    concurrency,
    connection,
  });

  // Логируем события worker'а
  worker.on('completed', (job) => {
    logSuccess(`Job ${job.id} завершен успешно`);
  });

  worker.on('failed', (job, err) => {
    logError(`Job ${job?.id} завершился с ошибкой: ${err.message}`);
  });

  worker.on('error', (err) => {
    logError(`Ошибка worker'а: ${err.message}`);
  });

  return worker;
}

export async function enqueueIndex(doc: IndexedMessage) {
  const opts: JobsOptions = {
    attempts: Number(process.env.INDEX_MAX_ATTEMPTS || 5),
    backoff: { type: "fixed", delay: Number(process.env.INDEX_BACKOFF_MS || 2000) },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  };
  
  try {
    await indexQueue.add("index", { doc }, opts);
    logInfo(`Сообщение ${doc.chat_id}:${doc.message_id} добавлено в очередь индексации`);
  } catch (error) {
    logError(`Ошибка добавления в очередь: ${(error as Error).message}`);
    throw error;
  }
}

export async function getQueueStats() {
  try {
    const waiting = await indexQueue.getWaiting();
    const active = await indexQueue.getActive();
    const completed = await indexQueue.getCompleted();
    const failed = await indexQueue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  } catch (error) {
    logError(`Ошибка получения статистики очереди: ${(error as Error).message}`);
    return null;
  }
}

export async function logQueueStats() {
  const stats = await getQueueStats();
  if (stats) {
    logInfo(`Статистика очереди: ожидает=${stats.waiting}, активно=${stats.active}, завершено=${stats.completed}, ошибок=${stats.failed}`);
  }
}
