import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { electron } from '@service/electron';
import { sessions } from '@service/sessions';

import * as fs from 'fs';
import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.ExportSession.Request,
    CancelablePromise<Requests.File.ExportSession.Response>
>(
    (
        log: Logger,
        request: Requests.File.ExportSession.Request,
    ): CancelablePromise<Requests.File.ExportSession.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const session = sessions.get(request.uuid);
            if (session === undefined) {
                return resolve(
                    new Requests.File.ExportSession.Response({
                        error: `Session ${request.uuid} isn't found`,
                    }),
                );
            }
            electron
                .dialogs()
                .saveFile('.txt')
                .then((filename: string | undefined) => {
                    if (filename === undefined) {
                        return resolve(new Requests.File.ExportSession.Response({}));
                    }
                    session.session
                        .getNativeSession()
                        .getSessionFile()
                        .then((sessionFileName: string) => {
                            fs.promises
                                .copyFile(sessionFileName, filename)
                                .then(() => {
                                    resolve(new Requests.File.ExportSession.Response({}));
                                })
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.File.ExportSession.Response({
                                            error: err.message,
                                        }),
                                    );
                                });
                        })
                        .catch((err: Error) => {
                            resolve(
                                new Requests.File.ExportSession.Response({
                                    error: `Fail get session file: ${err.message}`,
                                }),
                            );
                        });
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.File.ExportSession.Response({
                            error: `Fail select file to save: ${err.message}`,
                        }),
                    );
                });
        });
    },
);
