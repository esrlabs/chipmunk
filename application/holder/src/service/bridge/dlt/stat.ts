import { CancelablePromise } from 'platform/env/promise';
import { dlt } from 'rustcore';
import { Instance as Logger } from 'platform/env/logger';
import { jobs } from '@service/jobs';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Dlt.Stat.Request,
    CancelablePromise<Requests.Dlt.Stat.Response>
>(
    (
        log: Logger,
        request: Requests.Dlt.Stat.Request,
    ): CancelablePromise<Requests.Dlt.Stat.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const scanning = jobs
                .create({
                    desc: 'scanning dlt',
                    pinned: false,
                })
                .start();
            dlt.stats(request.files)
                .then((stat: dlt.Types.StatisticInfo) => {
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
