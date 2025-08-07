import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';

export type AppError = { message: string; cause?: unknown };

export const toError = (e: unknown): AppError => ({
  message: e instanceof Error ? e.message : 'Неизвестная ошибка',
  cause: e,
});

export const tryCatch = <A>(f: () => Promise<A>, onError: (e: unknown) => AppError): TE.TaskEither<AppError, A> =>
  TE.tryCatch(f, onError);
