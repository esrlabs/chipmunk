import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.ListInstalled.Request,
    CancelablePromise<Requests.Plugins.ListInstalledPaths.Response>
>(
    (
        _log: Logger,
        _request: Requests.Plugins.ListInstalledPaths.Request,
    ): CancelablePromise<Requests.Plugins.ListInstalledPaths.Response> => {
        return new CancelablePromise((reslove, reject) => {
            unbound.jobs
                .installedPluginsPaths()
                .then((paths) => {
                    reslove(new Requests.Plugins.ListInstalledPaths.Response({ paths }));
                })
                .catch(reject);
        });
    },
);
