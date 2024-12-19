import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { jobs } from '@service/jobs';
import { unbound } from '@service/unbound';
import { DltStatisticInfo } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Dlt.Stat.Request,
    CancelablePromise<Requests.Dlt.Stat.Response>
>(
    (
        _log: Logger,
        request: Requests.Dlt.Stat.Request,
    ): CancelablePromise<Requests.Dlt.Stat.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const scanning = jobs
                .create({
                    name: 'scanning dlt',
                    desc:
                        request.files.length === 1
                            ? `file: ${request.files[0]}`
                            : `${request.files.length} for files`,
                })
                .start();
            unbound.jobs
                .getDltStats(request.files)
                .then((stat: DltStatisticInfo) => {
                    resolve(
                        new Requests.Dlt.Stat.Response({
                            stat,
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
