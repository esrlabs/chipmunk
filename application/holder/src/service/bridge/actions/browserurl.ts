import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { shell } from 'electron';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Actions.UrlInBrowser.Request,
    CancelablePromise<Requests.Actions.UrlInBrowser.Response>
>(
    (
        _log: Logger,
        request: Requests.Actions.UrlInBrowser.Request,
    ): CancelablePromise<Requests.Actions.UrlInBrowser.Response> => {
        return new CancelablePromise((resolve, reject) => {
            shell
                .openExternal(request.url)
                .then(() => {
                    resolve(new Requests.Actions.UrlInBrowser.Response());
                })
                .catch(reject);
        });
    },
);
