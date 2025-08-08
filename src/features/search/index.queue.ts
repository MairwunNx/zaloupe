import { Queue, Worker, JobsOptions } from "bullmq";
import { getRedis } from "../../shared/redis";
import { indexMessage } from "./search.service";
import { IndexedMessage } from "./search.types";

const connection = getRedis();
export const INDEX_QUEUE_NAME = "index-messages" as const;

export const indexQueue = new Queue(INDEX_QUEUE_NAME, { connection });

export type IndexJobData = { doc: IndexedMessage };

export function startIndexWorker(concurrency = Number(process.env.INDEX_CONCURRENCY || 4)) {
  const processor = async (job: { data: IndexJobData }) => {
    await indexMessage(job.data.doc);
  };
  // Note: BullMQ Worker requires ioredis connection options, not instance
  // We pass connection string via env to new Worker implicitly
  return new Worker(INDEX_QUEUE_NAME, processor as any, {
    concurrency,
    connection,
  });
}

export async function enqueueIndex(doc: IndexedMessage) {
  const opts: JobsOptions = {
    attempts: Number(process.env.INDEX_MAX_ATTEMPTS || 5),
    backoff: { type: "fixed", delay: Number(process.env.INDEX_BACKOFF_MS || 2000) },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  };
  await indexQueue.add("index", { doc }, opts);
}
