import telegramifyMarkdown from "telegramify-markdown";

export const escapeMd = (s: string) => telegramifyMarkdown(s, "keep");

export function formatDateDMY(date: string | number | Date): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
