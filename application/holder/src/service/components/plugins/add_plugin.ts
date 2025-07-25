import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.AddPlugin.Request,
    CancelablePromise<Requests.Plugins.AddPlugin.Response>
>(
    (
        _log: Logger,
        request: Requests.Plugins.AddPlugin.Request,
    ): CancelablePromise<Requests.Plugins.AddPlugin.Response> => {
        return new CancelablePromise((reslove, reject) => {
            components.components
                .addPlugin(request.pluginPath)
                .then(() => {
                    reslove(new Requests.Plugins.AddPlugin.Response({}));
                })
                .catch(reject);
        });
    },
);
