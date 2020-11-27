import { Logger } from '../util/logging';
import { CancelablePromise } from '../util/promise';
import { RustSessionChannel } from '../native/native.session';

export { Logger, CancelablePromise };

export type TExecutor<TReturn, TOptions> = (session: RustSessionChannel, logger: Logger, uuid: string, options: TOptions) => CancelablePromise<TReturn>;
