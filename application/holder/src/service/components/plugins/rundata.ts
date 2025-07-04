import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.PluginRunData.Request,
    CancelablePromise<Requests.Plugins.PluginRunData.Response>
>(
    (
        _log: Logger,
        request: Requests.Plugins.PluginRunData.Request,
    ): CancelablePromise<Requests.Plugins.PluginRunData.Response> => {
        return new CancelablePromise((reslove, reject) => {
            components.components
                .getPluginRunData(request.pluginPath)
                .then((data) => {
                    reslove(new Requests.Plugins.PluginRunData.Response({ data }));
                })
                .catch(reject);
        });
    },
);
