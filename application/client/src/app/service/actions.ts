import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { api } from '@service/api';
import { CancelablePromise } from '@platform/env/promise';
import { FileType } from '@platform/types/files';

import * as Requests from '@platform/ipc/request';
import * as handlers from '@service/actions/index';

@SetupService(services['actions'])
export class Service extends Implementation {
    public override ready(): Promise<void> {
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Actions.OpenFile.Request,
                    (
                        request: Requests.Actions.OpenFile.Request,
                    ): CancelablePromise<Requests.Actions.OpenFile.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            (() => {
                                switch (request.type) {
                                    case FileType.Any:
                                        return new handlers.FileAny.Action().apply();
                                    case FileType.Dlt:
                                        return new handlers.FileDlt.Action().apply();
                                    case FileType.Pcap:
                                        return new handlers.FilePcap.Action().apply();
                                    default:
                                        return Promise.reject(
                                            new Error(`Unsupported format: ${request.type}`),
                                        );
                                }
                            })()
                                .then(() =>
                                    resolve(
                                        new Requests.Actions.OpenFile.Response({
                                            error: undefined,
                                        }),
                                    ),
                                )
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.Actions.OpenFile.Response({
                                            error: err.message,
                                        }),
                                    );
                                });
                        });
                    },
                ),
        );
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Actions.OpenFolder.Request,
                    (
                        request: Requests.Actions.OpenFolder.Request,
                    ): CancelablePromise<Requests.Actions.OpenFolder.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            (() => {
                                switch (request.type) {
                                    case FileType.Any:
                                        return new handlers.FolderAny.Action().apply();
                                    case FileType.Dlt:
                                        return new handlers.FolderDlt.Action().apply();
                                    case FileType.Pcap:
                                        return new handlers.FolderPcap.Action().apply();
                                    default:
                                        return Promise.reject(
                                            new Error(`Unsupported format: ${request.type}`),
                                        );
                                }
                            })()
                                .then(() =>
                                    resolve(
                                        new Requests.Actions.OpenFolder.Response({
                                            error: undefined,
                                        }),
                                    ),
                                )
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.Actions.OpenFolder.Response({
                                            error: err.message,
                                        }),
                                    );
                                });
                        });
                    },
                ),
        );
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const actions = register(new Service());
