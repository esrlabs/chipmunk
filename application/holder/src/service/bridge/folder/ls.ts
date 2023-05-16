import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';
import * as fs from 'fs';
import * as path from 'path';

export const handler = Requests.InjectLogger<
    Requests.Folder.Ls.Request,
    CancelablePromise<Requests.Folder.Ls.Response>
>(
    (
        _log: Logger,
        request: Requests.Folder.Ls.Request,
    ): CancelablePromise<Requests.Folder.Ls.Response> => {
        return new CancelablePromise((resolve, reject) => {
            fs.promises
                .readdir(request.paths[0], { withFileTypes: true })
                .then((list) => {
                    resolve(
                        new Requests.Folder.Ls.Response({
                            folders: list
                                .filter((el) => el.isDirectory())
                                .map((el) => path.resolve(request.paths[0], el.name)),
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
