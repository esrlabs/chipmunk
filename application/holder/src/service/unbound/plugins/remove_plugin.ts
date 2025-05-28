import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.RemovePlugin.Request,
    CancelablePromise<Requests.Plugins.RemovePlugin.Response>
>(
    (
        _log: Logger,
        request: Requests.Plugins.RemovePlugin.Request,
    ): CancelablePromise<Requests.Plugins.RemovePlugin.Response> => {
        return new CancelablePromise((reslove, reject) => {
            unbound.jobs
                .removePlugin(request.pluginPath)
                .then(() => {
                    reslove(new Requests.Plugins.RemovePlugin.Response({}));
                })
                .catch(reject);
        });
    },
);
