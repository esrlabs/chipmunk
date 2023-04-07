import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { Entity, EntityType } from 'platform/types/files';

import * as Requests from 'platform/ipc/request';
import * as fs from 'fs';
import * as path from 'path';

export const handler = Requests.InjectLogger<
    Requests.Os.AsFSEntity.Request,
    CancelablePromise<Requests.Os.AsFSEntity.Response>
>(
    (
        log: Logger,
        request: Requests.Os.AsFSEntity.Request,
    ): CancelablePromise<Requests.Os.AsFSEntity.Response> => {
        return new CancelablePromise((resolve) => {
            fs.promises
                .stat(request.path)
                .then((stats: fs.Stats) => {
                    const entity: Entity = {
                        name: request.path,
                        fullname: path.normalize(request.path),
                        type: (() => {
                            if (stats.isBlockDevice()) {
                                return EntityType.BlockDevice;
                            } else if (stats.isCharacterDevice()) {
                                return EntityType.CharacterDevice;
                            } else if (stats.isDirectory()) {
                                return EntityType.Directory;
                            } else if (stats.isFIFO()) {
                                return EntityType.FIFO;
                            } else if (stats.isFile()) {
                                return EntityType.File;
                            } else if (stats.isSocket()) {
                                return EntityType.Socket;
                            } else {
                                return EntityType.SymbolicLink;
                            }
                        })(),
                    };
                    if (stats.isFile() || stats.isSocket() || stats.isSymbolicLink()) {
                        entity.details = {
                            filename: request.path,
                            full: path.normalize(request.path),
                            path: path.dirname(request.path),
                            basename: path.basename(request.path),
                            ext: path.extname(request.path),
                        };
                    }
                    resolve(
                        new Requests.Os.AsFSEntity.Response({
                            entity,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Os.AsFSEntity.Response({
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
