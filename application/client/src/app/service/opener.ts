import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Channel, Services } from '@service/ilc';
import { Session } from './session/session';
import { components } from '@env/decorators/initial';
import { TabControls } from './session/tab';
import { File } from '@platform/types/files';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition } from '@platform/types/transport';

import { getRenderFor } from '@schema/render/tools';

export { Session, TabControls };

@SetupService(services['opener'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _channel!: Channel;
    private _services!: Services;

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        this._channel = ilc.channel(this.getName(), this.log());
        this._services = ilc.services(this.getName(), this.log());
        return Promise.resolve();
    }

    public stream(): {
        dlt(
            options?: { source: SourceDefinition; options: IDLTOptions },
            openPresetSettings?: boolean,
        ): Promise<void>;
    } {
        return {
            dlt: (
                options?: { source: SourceDefinition; options: IDLTOptions },
                openPresetSettings?: boolean,
            ): Promise<void> => {
                const open = (opt: {
                    source: SourceDefinition;
                    options: IDLTOptions;
                }): Promise<void> => {
                    return new Promise((resolve, reject) => {
                        this._services.system.session
                            .add()
                            .empty(getRenderFor().dlt())
                            .then((session) => {
                                session
                                    .connect(opt.source)
                                    .dlt(opt.options)
                                    .then(() => {
                                        this._services.system.recent
                                            .add()
                                            .stream(opt.source)
                                            .dlt(opt.options)
                                            .catch((err: Error) => {
                                                this.log().error(
                                                    `Fail to add recent action; error: ${err.message}`,
                                                );
                                            });
                                        resolve();
                                    })
                                    .catch((err: Error) => {
                                        this.log().error(`Fail to connect: ${err.message}`);
                                        reject(err);
                                    });
                            })
                            .catch((err: Error) => {
                                this.log().error(`Fail to create session: ${err.message}`);
                                reject(err);
                            });
                    });
                };
                return new Promise((resolve, reject) => {
                    if (options !== undefined && openPresetSettings !== true) {
                        open(options).then(resolve).catch(reject);
                    } else {
                        this._services.system.session.add().tab({
                            name: `Connecting to DLT Deamon`,
                            content: {
                                factory: components.get('app-tabs-source-dltnet'),
                                inputs: {
                                    options: options,
                                    done: (options: {
                                        source: SourceDefinition;
                                        options: IDLTOptions;
                                    }) => {
                                        open(options).then(resolve).catch(reject);
                                    },
                                },
                            },
                            active: true,
                        });
                    }
                });
            },
        };
    }

    public file(file: File | string): {
        text(): Promise<void>;
        dlt(options?: IDLTOptions): Promise<void>;
    } {
        return {
            text: async (): Promise<void> => {
                const target =
                    typeof file === 'string'
                        ? (await this._services.system.bridge.files().getByPath([file]))[0]
                        : file;
                return new Promise((resolve, reject) => {
                    this._services.system.session
                        .add()
                        .file(
                            {
                                filename: target.filename,
                                name: target.name,
                                type: target.type,
                                options: {},
                            },
                            getRenderFor().text(),
                        )
                        .then(() => {
                            this._services.system.recent
                                .add()
                                .file(target, {})
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to add recent action; error: ${err.message}`,
                                    );
                                });
                            resolve();
                        })
                        .catch((err: Error) => {
                            this.log().error(`Fail to create session: ${err.message}`);
                            reject(err);
                        });
                });
            },
            dlt: async (options?: IDLTOptions): Promise<void> => {
                const target =
                    typeof file === 'string'
                        ? (await this._services.system.bridge.files().getByPath([file]))[0]
                        : file;
                const open = (opt: IDLTOptions): Promise<void> => {
                    return new Promise((resolve, reject) => {
                        this._services.system.session
                            .add()
                            .file(
                                {
                                    filename: target.filename,
                                    name: target.name,
                                    type: target.type,
                                    options: {
                                        dlt: opt,
                                    },
                                },
                                getRenderFor().dlt(),
                            )
                            .then(() => {
                                this._services.system.recent
                                    .add()
                                    .file(target, { dlt: opt })
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail to add recent action; error: ${err.message}`,
                                        );
                                    });
                                resolve();
                            })
                            .catch((err: Error) => {
                                this.log().error(`Fail to create session: ${err.message}`);
                                reject(err);
                            });
                    });
                };
                return new Promise((resolve, reject) => {
                    if (options !== undefined) {
                        open(options).then(resolve).catch(reject);
                    } else {
                        this._services.system.session.add().tab({
                            name: `Opening DLT file`,
                            content: {
                                factory: components.get('app-tabs-source-dltfile'),
                                inputs: {
                                    file,
                                    done: (opt: IDLTOptions) => {
                                        open(opt).then(resolve).catch(reject);
                                    },
                                },
                            },
                            active: true,
                        });
                    }
                });
            },
        };
    }
}
export interface Service extends Interface {}
export const opener = register(new Service());
