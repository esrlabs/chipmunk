import { CancelablePromise } from '@platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from '@platform/env/logger';
import { CancelablePromise as RustcorePromise } from 'rustcore';

import * as Requests from '@platform/ipc/request';
import { ISearchResults } from '@platform/types/filter';

class Previous {
    private _job: RustcorePromise<ISearchResults> | undefined;
    public set(job: RustcorePromise<ISearchResults>) {
        this._job = job;
    }
    public drop() {
        this._job = undefined;
    }
    public has(): boolean {
        return this._job !== undefined;
    }
    public job(): RustcorePromise<ISearchResults> {
        if (this._job === undefined) {
            throw new Error(`There are no previous job`);
        }
        return this._job;
    }
}

const previous = new Previous();

export const handler = Requests.InjectLogger<
    Requests.Search.Search.Request,
    CancelablePromise<Requests.Search.Search.Response>
>(
    (
        log: Logger,
        request: Requests.Search.Search.Request,
    ): CancelablePromise<Requests.Search.Search.Response> => {
        return new CancelablePromise<Requests.Search.Search.Response>((resolve, reject) => {
            ((executor: () => void) => {
                if (previous.has()) {
                    previous.job().finally(() => {
                        executor();
                    });
                    previous.job().abort();
                } else {
                    executor();
                }
            })(() => {
                const stored = sessions.get(request.session);
                if (stored === undefined) {
                    return reject(new Error(`Session doesn't exist`));
                }
                previous.set(
                    stored.session
                        .getSearch()
                        .search(request.filters)
                        .then((results: ISearchResults) => {
                            resolve(
                                new Requests.Search.Search.Response({
                                    session: request.session,
                                    results,
                                    canceled: false,
                                }),
                            );
                        })
                        .canceled(() => {
                            resolve(
                                new Requests.Search.Search.Response({
                                    session: request.session,
                                    results: undefined,
                                    canceled: true,
                                }),
                            );
                        })
                        .catch((error: Error) => {
                            reject(error);
                        })
                        .finally(() => {
                            previous.drop();
                        }),
                );
            });
        });
    },
);
