import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';
import * as path from 'path';

export const handler = Requests.InjectLogger<
    Requests.Folder.Delimiter.Request,
    CancelablePromise<Requests.Folder.Delimiter.Response>
>(
    (
        _log: Logger,
        _request: Requests.Folder.Delimiter.Request,
    ): CancelablePromise<Requests.Folder.Delimiter.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            resolve(new Requests.Folder.Delimiter.Response({ delimiter: path.sep }));
        });
    },
);
