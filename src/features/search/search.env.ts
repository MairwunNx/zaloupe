import dotenv from "dotenv";

dotenv.config();

export const ELASTIC_URL = process.env.ELASTIC_URL ?? "http://localhost:9200";
export const ELASTIC_USERNAME = process.env.ELASTIC_USERNAME ?? undefined;
export const ELASTIC_PASSWORD = process.env.ELASTIC_PASSWORD ?? undefined;
export const ELASTIC_INDEX = process.env.ELASTIC_INDEX ?? "messages";
