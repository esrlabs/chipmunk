import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';
import { paths } from '@service/paths';

import * as Requests from 'platform/ipc/request';
import * as path from 'path';

export const handler = Requests.InjectLogger<
    Requests.Session.ExportRaw.Request,
    CancelablePromise<Requests.Session.ExportRaw.Response>
>(
    (
        _log: Logger,
        request: Requests.Session.ExportRaw.Request,
    ): CancelablePromise<Requests.Session.ExportRaw.Response> => {
        return new CancelablePromise<Requests.Session.ExportRaw.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            const dest = (() => {
                if (request.dest !== undefined) {
                    return request.dest;
                } else {
                    const ext = stored.getFileExt();
                    if (ext instanceof Error) {
                        return ext;
                    }
                    return path.join(
                        paths.getTmp(),
                        `export_${new Date().toLocaleTimeString().replace(/[^\d]/gi, '_')}${ext}`,
                    );
                }
            })();
            if (dest instanceof Error) {
                return resolve(
                    new Requests.Session.ExportRaw.Response({
                        filename: undefined,
                        error: dest.message,
                    }),
                );
            }
            stored.session
                .getStream()
                .exportRaw(dest, request.ranges)
                .then((complete) => {
                    resolve(
                        new Requests.Session.ExportRaw.Response({
                            filename: complete ? dest : undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Session.ExportRaw.Response({
                            filename: undefined,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
