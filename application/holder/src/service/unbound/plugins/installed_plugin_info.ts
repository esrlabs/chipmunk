import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.InstalledPluginInfo.Request,
    CancelablePromise<Requests.Plugins.InstalledPluginInfo.Response>
>(
    (
        _log: Logger,
        request: Requests.Plugins.InstalledPluginInfo.Request,
    ): CancelablePromise<Requests.Plugins.InstalledPluginInfo.Response> => {
        return new CancelablePromise((reslove, reject) => {
            unbound.jobs
                .installedPluginsInfo(request.pluginPath)
                .then((plugin) => {
                    reslove(new Requests.Plugins.InstalledPluginInfo.Response({ plugin }));
                })
                .catch(reject);
        });
    },
);
