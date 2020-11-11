import { Logger } from '../util/logging';
import { CancelablePromise } from '../util/promise';

export { Logger, CancelablePromise };

export type TExecutor<TReturn, TOptions> = (logger: Logger, uuid: string, options: TOptions) => CancelablePromise<TReturn>;
