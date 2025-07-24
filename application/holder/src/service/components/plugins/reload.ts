import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.Reload.Request,
    CancelablePromise<Requests.Plugins.Reload.Response>
>(
    (
        _log: Logger,
        _request: Requests.Plugins.Reload.Request,
    ): CancelablePromise<Requests.Plugins.Reload.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .reloadPlugins()
                .then(() => {
                    resolve(new Requests.Plugins.Reload.Response({}));
                })
                .catch(reject);
        });
    },
);
