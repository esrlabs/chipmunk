import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';
import { paths } from '@service/paths';

import * as Requests from 'platform/ipc/request';
import * as path from 'path';

export const handler = Requests.InjectLogger<
    Requests.Session.Export.Request,
    CancelablePromise<Requests.Session.Export.Response>
>(
    (
        _log: Logger,
        request: Requests.Session.Export.Request,
    ): CancelablePromise<Requests.Session.Export.Response> => {
        return new CancelablePromise<Requests.Session.Export.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            const dest = (() => {
                if (request.dest !== undefined) {
                    return request.dest;
                } else {
                    const ext = stored.getExportedFileExt();
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
                .export(dest, request.ranges, request.options)
                .then((complete) => {
                    resolve(
                        new Requests.Session.Export.Response({
                            filename: complete ? dest : undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Session.Export.Response({
                            filename: undefined,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
