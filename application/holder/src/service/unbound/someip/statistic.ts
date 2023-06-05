import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { jobs } from '@service/jobs';
import { unbound } from '@service/unbound';
import { SomeipStatistic } from 'platform/types/parsers/someip';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Dlt.Stat.Request,
    CancelablePromise<Requests.Someip.Statistic.Response>
>(
    (
        _log: Logger,
        request: Requests.Dlt.Stat.Request,
    ): CancelablePromise<Requests.Someip.Statistic.Response> => {
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
                .getSomeipStatistic(request.files)
                .then((statistic: SomeipStatistic) => {
                    resolve(
                        new Requests.Someip.Statistic.Response({
                            statistic,
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
