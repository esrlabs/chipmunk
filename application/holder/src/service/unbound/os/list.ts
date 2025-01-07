import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { error } from 'platform/log/utils';
import { unbound } from '@service/unbound';
import { FoldersScanningResult } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Os.List.Request,
    CancelablePromise<Requests.Os.List.Response>
>(
    (
        log: Logger,
        request: Requests.Os.List.Request,
    ): CancelablePromise<Requests.Os.List.Response> => {
        return new CancelablePromise((resolve, reject) => {
            unbound.jobs
                .listContent(request)
                .then((res: FoldersScanningResult) => {
                    try {
                        resolve(
                            new Requests.Os.List.Response({
                                entities: res.list,
                                max: res.max_len_reached,
                            }),
                        );
                    } catch (e) {
                        log.warn(`Error to parse listContent data: ${error(e)}`);
                        reject(new Error(error(e)));
                    }
                })
                .catch(reject);
        });
    },
);
