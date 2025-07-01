import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';

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
            components.components
                .invalidPluginsInfo(request.pluginPath)
                .then((invalidPlugin) => {
                    reslove(new Requests.Plugins.InvalidPluginInfo.Response({ invalidPlugin }));
                })
                .catch(reject);
        });
    },
);
