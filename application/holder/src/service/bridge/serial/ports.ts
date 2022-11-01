import { CancelablePromise } from 'platform/env/promise';
import { serial } from 'rustcore';
import { Instance as Logger } from 'platform/env/logger';
import { jobs } from '@service/jobs';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Serial.Ports.Request,
    CancelablePromise<Requests.Serial.Ports.Response>
>(
    (
        log: Logger,
        request: Requests.Serial.Ports.Request,
    ): CancelablePromise<Requests.Serial.Ports.Response> => {
        return new CancelablePromise((resolve, reject) => {
            log.info(request);
            const scanning = jobs
                .create({
                    name: 'scan ports',
                    desc: 'fetching serial ports data',
                })
                .start();
            serial
                .ports()
                .then((ports: string[]) => {
                    resolve(
                        new Requests.Serial.Ports.Response({
                            ports,
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
