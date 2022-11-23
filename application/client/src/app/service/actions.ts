import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { api } from '@service/api';
import { CancelablePromise } from '@platform/env/promise';
import { FileType } from '@platform/types/files';
import { ParserName } from '@platform/types/observe';

import * as Requests from '@platform/ipc/request';
import * as handlers from '@service/actions/index';
import { Source } from '@platform/types/transport';

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
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Actions.Stream.Request,
                    (
                        request: Requests.Actions.Stream.Request,
                    ): CancelablePromise<Requests.Actions.Stream.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            (() => {
                                switch (request.type) {
                                    case ParserName.Text:
                                        switch (request.source) {
                                            case undefined:
                                                return new handlers.StreamTextOnCustom.Action().apply();
                                            case Source.Process:
                                                return new handlers.StdoutText.Action().apply();
                                            case Source.Serial:
                                                return new handlers.SerialText.Action().apply();
                                            default:
                                                return Promise.reject(
                                                    new Error(
                                                        `Unsupported transport for Text: ${request.source}`,
                                                    ),
                                                );
                                        }
                                    case ParserName.Dlt:
                                        switch (request.source) {
                                            case undefined:
                                                return new handlers.StreamDltOnCustom.Action().apply();
                                            case Source.Udp:
                                                return new handlers.UdpDlt.Action().apply();
                                            case Source.Tcp:
                                                return new handlers.TcpDlt.Action().apply();
                                            case Source.Serial:
                                                return new handlers.SerialDlt.Action().apply();
                                            default:
                                                return Promise.reject(
                                                    new Error(
                                                        `Unsupported transport for DLT: ${request.source}`,
                                                    ),
                                                );
                                        }
                                    default:
                                        return Promise.reject(
                                            new Error(`Unsupported format: ${request.type}`),
                                        );
                                }
                            })()
                                .then(() =>
                                    resolve(
                                        new Requests.Actions.Stream.Response({
                                            error: undefined,
                                        }),
                                    ),
                                )
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.Actions.Stream.Response({
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
