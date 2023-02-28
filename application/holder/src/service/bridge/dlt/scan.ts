import { CancelablePromise } from 'platform/env/promise';
import { dlt } from 'rustcore';
import { Instance as Logger } from 'platform/env/logger';
import { jobs } from '@service/jobs';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Dlt.Scan.Request,
    CancelablePromise<Requests.Dlt.Scan.Response>
>(
    (
        log: Logger,
        request: Requests.Dlt.Scan.Request,
    ): CancelablePromise<Requests.Dlt.Scan.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const scanning = jobs
                .create({
                    name: 'scanning dlt',
                    desc: `file: ${request.file}`,
                })
                .start();
            dlt.scan(request.file, request.options)
                .then((attachments: dlt.Types.Attachment[]) => {
                    resolve(
                        new Requests.Dlt.Scan.Response({
                            attachments,
                        }),
                    );
                })
                .catch(reject)
                .finally(() => {
                    scanning.done();
                });
        });
    },
);
