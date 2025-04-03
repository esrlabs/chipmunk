import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.InvalidPluginInfo.Request,
    CancelablePromise<Requests.Plugins.InvalidPluginInfo.Response>
>(
    (
        _log: Logger,
        request: Requests.Plugins.InvalidPluginInfo.Request,
    ): CancelablePromise<Requests.Plugins.InvalidPluginInfo.Response> => {
        return new CancelablePromise((reslove, reject) => {
            unbound.jobs
                .invalidPluginsInfo(request.pluginPath)
                .then((invalidPlugin) => {
                    reslove(new Requests.Plugins.InvalidPluginInfo.Response({ invalidPlugin }));
                })
                .catch(reject);
        });
    },
);
