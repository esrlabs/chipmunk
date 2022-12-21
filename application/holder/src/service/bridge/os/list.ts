import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { Entity, EntityType } from 'platform/types/files';

import * as Requests from 'platform/ipc/request';
import * as fs from 'fs';
import * as path from 'path';

export const handler = Requests.InjectLogger<
    Requests.Os.List.Request,
    CancelablePromise<Requests.Os.List.Response>
>(
    (
        log: Logger,
        request: Requests.Os.List.Request,
    ): CancelablePromise<Requests.Os.List.Response> => {
        return new CancelablePromise((resolve, reject) => {
            fs.promises
                .readdir(request.path, { withFileTypes: true })
                .then((list: fs.Dirent[]) => {
                    resolve(
                        new Requests.Os.List.Response({
                            entities: list.map((entity: fs.Dirent) => {
                                const output: Entity = {
                                    name: entity.name,
                                    fullname: path.resolve(
                                        path.normalize(request.path),
                                        entity.name,
                                    ),
                                    type: (() => {
                                        if (entity.isBlockDevice()) {
                                            return EntityType.BlockDevice;
                                        } else if (entity.isCharacterDevice()) {
                                            return EntityType.CharacterDevice;
                                        } else if (entity.isDirectory()) {
                                            return EntityType.Directory;
                                        } else if (entity.isFIFO()) {
                                            return EntityType.FIFO;
                                        } else if (entity.isFile()) {
                                            return EntityType.File;
                                        } else if (entity.isSocket()) {
                                            return EntityType.Socket;
                                        } else {
                                            return EntityType.SymbolicLink;
                                        }
                                    })(),
                                };
                                if (
                                    entity.isFile() ||
                                    entity.isSocket() ||
                                    entity.isSymbolicLink()
                                ) {
                                    output.details = {
                                        filename: entity.name,
                                        path: path.normalize(request.path),
                                        full: path.resolve(
                                            path.normalize(request.path),
                                            entity.name,
                                        ),
                                        basename: path.basename(entity.name),
                                        ext: path.extname(entity.name),
                                    };
                                }
                                return output;
                            }),
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
