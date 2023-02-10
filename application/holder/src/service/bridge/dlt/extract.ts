import { CancelablePromise } from 'platform/env/promise';
import { dlt } from 'rustcore';
import { Instance as Logger } from 'platform/env/logger';
import { jobs } from '@service/jobs';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Dlt.Extract.Request,
    CancelablePromise<Requests.Dlt.Extract.Response>
>(
    (
        log: Logger,
        request: Requests.Dlt.Extract.Request,
    ): CancelablePromise<Requests.Dlt.Extract.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const scanning = jobs
                .create({
                    name: 'extract dlt',
                    desc: `file: ${request.file}`,
                })
                .start();
            if (request.attachments === undefined) {
                dlt.extractAllFiles(
                    request.file,
                    request.output,
                    request.options
                )
                    .then((size: number) => {
                        resolve(
                            new Requests.Dlt.Extract.Response({
                                size,
                            }),
                        );
                    })
                    .catch(reject)
                    .finally(() => {
                        scanning.done();
                    });
            } else {
                dlt.extractSelectedFiles(
                    request.file,
                    request.output,
                    request.attachments,
                    request.options
                )
                    .then((size: number) => {
                        resolve(
                            new Requests.Dlt.Extract.Response({
                                size,
                            }),
                        );
                    })
                    .catch(reject)
                    .finally(() => {
                        scanning.done();
                    });
            }
        });
    },
);
