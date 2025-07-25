import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.ListInstalled.Request,
    CancelablePromise<Requests.Plugins.ListInstalled.Response>
>(
    (
        _log: Logger,
        _request: Requests.Plugins.ListInstalled.Request,
    ): CancelablePromise<Requests.Plugins.ListInstalled.Response> => {
        return new CancelablePromise((reslove, reject) => {
            components.components
                .installedPluginsList()
                .then((plugins) => {
                    reslove(new Requests.Plugins.ListInstalled.Response({ plugins }));
                })
                .catch(reject);
        });
    },
);
