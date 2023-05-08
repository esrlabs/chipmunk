import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { error } from 'platform/log/utils';
import { Entity, entityFromObj } from 'platform/types/files';
import { unbound } from '@service/unbound';

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
                .listContent(request.deep, request.path)
                .then((content: string) => {
                    try {
                        const list = typeof content === 'string' ? JSON.parse(content) : content;
                        if (!(list instanceof Array)) {
                            log.warn(`Gets invalid data from listContent`);
                            return reject(new Error(`Invalid data`));
                        }
                        resolve(
                            new Requests.Os.List.Response({
                                entities: list
                                    .map((smth: { [key: string]: unknown }) => {
                                        try {
                                            return entityFromObj(smth);
                                        } catch (e) {
                                            log.warn(
                                                `Fail to parse listContent entity: ${error(e)}`,
                                            );
                                            return undefined;
                                        }
                                    })
                                    .filter((e) => e !== undefined) as Entity[],
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
