import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { getEntities } from './select';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.File.Request,
    CancelablePromise<Requests.File.File.Response>
>(
    (
        log: Logger,
        request: Requests.File.File.Request,
    ): CancelablePromise<Requests.File.File.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const files = getEntities(request.filename);
            if (files instanceof Error) {
                reject(files);
            } else {
                resolve(
                    new Requests.File.File.Response({
                        files,
                    }),
                );
            }
        });
    },
);
