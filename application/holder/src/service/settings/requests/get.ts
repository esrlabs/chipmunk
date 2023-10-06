import { CancelablePromise } from 'platform/env/promise';
import { settings } from '@service/settings';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Settings.Get.Request,
    CancelablePromise<Requests.Settings.Get.Response>
>(
    (
        _log: Logger,
        request: Requests.Settings.Get.Request,
    ): CancelablePromise<Requests.Settings.Get.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const entry = settings.get().entry(request.path, request.key);
            return resolve(
                new Requests.Settings.Get.Response({
                    value: entry === undefined ? undefined : entry.value.get(),
                }),
            );
        });
    },
);
