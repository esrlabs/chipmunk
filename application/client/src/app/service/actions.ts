import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { api } from '@service/api';
import { CancelablePromise } from '@platform/env/promise';
import { FileType } from '@platform/types/observe/types/file';
import { Protocol } from '@platform/types/observe/parser';
import { Source } from '@platform/types/observe/origin/stream/index';

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
                                    case FileType.Text:
                                        return new handlers.FileText.Action().apply();
                                    case FileType.Binary:
                                        return new handlers.FileDlt.Action().apply();
                                    case FileType.PcapNG:
                                        return new handlers.FilePcap.Action().apply();
                                    default:
                                        return new handlers.FileAny.Action().apply();
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
                                    case FileType.Text:
                                        return new handlers.FolderText.Action().apply();
                                    case FileType.Binary:
                                        return new handlers.FolderDlt.Action().apply();
                                    case FileType.PcapNG:
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
                                switch (request.protocol) {
                                    case Protocol.Text:
                                        switch (request.source) {
                                            case undefined:
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
                                    case Protocol.Dlt:
                                        switch (request.source) {
                                            case undefined:
                                            case Source.UDP:
                                                return new handlers.UdpDlt.Action().apply();
                                            case Source.TCP:
                                                return new handlers.TcpDlt.Action().apply();
                                            default:
                                                return Promise.reject(
                                                    new Error(
                                                        `Unsupported transport for DLT: ${request.source}`,
                                                    ),
                                                );
                                        }
                                    default:
                                        return Promise.reject(
                                            new Error(`Unsupported format: ${request.protocol}`),
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
        this.register(
            api
                .transport()
                .respondent(
                    this.getName(),
                    Requests.Actions.About.Request,
                    (
                        _request: Requests.Actions.About.Request,
                    ): CancelablePromise<Requests.Actions.About.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.About.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(`Fail to call About action: ${err.message}`);
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.About.Response());
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
                    Requests.Actions.JumpTo.Request,
                    (
                        _request: Requests.Actions.JumpTo.Request,
                    ): CancelablePromise<Requests.Actions.JumpTo.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.JumpTo.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(`Fail to call JumpTo action: ${err.message}`);
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.About.Response());
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
                    Requests.Actions.FindInSearch.Request,
                    (
                        _request: Requests.Actions.FindInSearch.Request,
                    ): CancelablePromise<Requests.Actions.JumpTo.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.FindInSearch.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to call FindInSearch action: ${err.message}`,
                                    );
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.About.Response());
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
                    Requests.Actions.Updates.Request,
                    (
                        _request: Requests.Actions.Updates.Request,
                    ): CancelablePromise<Requests.Actions.Updates.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.Updates.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(`Fail to call Updates action: ${err.message}`);
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.Updates.Response());
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
                    Requests.Actions.Settings.Request,
                    (
                        _request: Requests.Actions.Settings.Request,
                    ): CancelablePromise<Requests.Actions.Settings.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.Settings.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to call Settings action: ${err.message}`,
                                    );
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.Settings.Response());
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
                    Requests.Actions.Help.Request,
                    (
                        _request: Requests.Actions.Help.Request,
                    ): CancelablePromise<Requests.Actions.Help.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.Help.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(`Fail to call Help action: ${err.message}`);
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.Help.Response());
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
                    Requests.Actions.ExportSessionState.Request,
                    (
                        _request: Requests.Actions.ExportSessionState.Request,
                    ): CancelablePromise<Requests.Actions.ExportSessionState.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.ExportSession.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to call ExportSessionState action: ${err.message}`,
                                    );
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.Help.Response());
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
                    Requests.Actions.ImportSessionState.Request,
                    (
                        _request: Requests.Actions.ImportSessionState.Request,
                    ): CancelablePromise<Requests.Actions.ImportSessionState.Response> => {
                        return new CancelablePromise((resolve, _reject) => {
                            new handlers.ImportSession.Action()
                                .apply()
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to call ImportSessionState action: ${err.message}`,
                                    );
                                })
                                .finally(() => {
                                    resolve(new Requests.Actions.Help.Response());
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
