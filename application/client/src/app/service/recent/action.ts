import { Recent as RecentFileAction, BaseInfo } from './implementations/file/file';
import { Recent as RecentStreamDltAction } from './implementations/stream/dlt';
import { Recent as RecentStreamTextAction } from './implementations/stream/text';

import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/env/logger';
import { unique } from '@platform/env/sequence';
import { TargetFileOptions, File } from '@platform/types/files';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition, SourceDefinitionHolder } from '@platform/types/transport';
import { opener } from '@service/opener';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { components } from '@env/decorators/initial';
import { lockers, Locker } from '@ui/service/lockers';

import * as obj from '@platform/env/obj';

export class Action {
    public file: RecentFileAction | undefined;
    public dlt_stream: RecentStreamDltAction | undefined;
    public text_stream: RecentStreamTextAction | undefined;

    public uuid: string = unique();

    public description(): {
        major: string;
        minor: string;
    } {
        if (this.file !== undefined) {
            return this.file.description();
        } else if (this.dlt_stream !== undefined) {
            return this.dlt_stream.description();
        } else if (this.text_stream !== undefined) {
            return this.text_stream.description();
        } else {
            throw new Error(`Unknonw type of action.`);
        }
    }

    public asFile(): BaseInfo | undefined {
        if (this.file === undefined) {
            return undefined;
        }
        return this.file.getBaseInfo();
    }

    public asComponent(): IComponentDesc {
        if (this.file !== undefined) {
            return this.file.asComponent();
        } else if (this.dlt_stream !== undefined) {
            return this.dlt_stream.asComponent();
        } else if (this.text_stream !== undefined) {
            return this.text_stream.asComponent();
        } else {
            throw new Error(`Unknonw type of action.`);
        }
    }

    public asEntry(): Entry {
        const body: { [key: string]: unknown } = {};
        if (this.file !== undefined) {
            body['file'] = this.file.asObj();
        } else if (this.dlt_stream !== undefined) {
            body['dlt_stream'] = this.dlt_stream.asObj();
        } else if (this.text_stream !== undefined) {
            body['text_stream'] = this.text_stream.asObj();
        } else {
            throw new Error(`Recent action isn't defined`);
        }
        return {
            uuid: this.uuid,
            content: JSON.stringify(body),
        };
    }

    public from(): {
        entry(entry: Entry): Action;
        file(file: File, options: TargetFileOptions): Action;
        stream(source: SourceDefinition): {
            dlt(options: IDLTOptions): Action;
            text(): Action;
        };
    } {
        return {
            entry: (entry: Entry): Action => {
                this.uuid = entry.uuid;
                try {
                    const action = JSON.parse(entry.content);
                    if (action['file'] !== undefined) {
                        this.file = new RecentFileAction().from(obj.asAnyObj(action['file']));
                    } else if (action['dlt_stream'] !== undefined) {
                        this.dlt_stream = new RecentStreamDltAction().from(
                            obj.asAnyObj(action['dlt_stream']),
                        );
                    } else if (action['text_stream'] !== undefined) {
                        this.text_stream = new RecentStreamTextAction().from(
                            obj.asAnyObj(action['text_stream']),
                        );
                    } else {
                        throw new Error(`Unknonw type of action.`);
                    }
                    return this;
                } catch (err) {
                    throw new Error(`Fail to parse action: ${error(err)}`);
                }
            },
            file: (file: File, options: TargetFileOptions): Action => {
                this.uuid = file.filename;
                try {
                    const opt: { [key: string]: unknown } = {
                        filename: file.filename,
                        name: file.name,
                        path: file.path,
                        size: file.stat.size,
                        created: file.stat.ctimeMs,
                    };
                    if (options.dlt !== undefined) {
                        opt['dlt'] = options.dlt;
                    } else if (options.pcap !== undefined) {
                        opt['pcap'] = options.pcap;
                    }
                    this.file = new RecentFileAction().from(opt);
                } catch (err) {
                    throw new Error(`Fail to parse action: ${error(err)}`);
                }
                return this;
            },
            stream: (source: SourceDefinition) => {
                const source_holder = new SourceDefinitionHolder(source);
                return {
                    dlt: (options: IDLTOptions): Action => {
                        this.uuid = source_holder.uuid();
                        try {
                            this.dlt_stream = new RecentStreamDltAction().from({ source, options });
                        } catch (err) {
                            throw new Error(`Fail to parse action: ${error(err)}`);
                        }
                        return this;
                    },
                    text: (): Action => {
                        this.uuid = source_holder.uuid();
                        try {
                            this.text_stream = new RecentStreamTextAction().from({ source });
                        } catch (err) {
                            throw new Error(`Fail to parse action: ${error(err)}`);
                        }
                        return this;
                    },
                };
            },
        };
    }

    public getActions(
        remove: (uuid: string[]) => void,
    ): Array<{ caption?: string; handler?: () => void }> {
        if (this.file !== undefined) {
            if (this.file.text !== undefined) {
                return [
                    {
                        caption: 'Reopen file',
                        handler: this.apply.bind(this, remove),
                    },
                ];
            } else if (this.file.dlt !== undefined) {
                const filename = this.file.dlt.filename;
                const options = this.file.dlt.options;
                return [
                    {
                        caption: 'Reopen file',
                        handler: this.apply.bind(this, remove),
                    },
                    {
                        caption: 'Open another file',
                        handler: () => {
                            bridge
                                .files()
                                .select.dlt()
                                .then((files: File[]) => {
                                    if (files.length !== 1) {
                                        return;
                                    }
                                    const file = files[0];
                                    session.add().tab({
                                        name: `Opening DLT file`,
                                        content: {
                                            factory: components.get('app-tabs-source-dltfile'),
                                            inputs: {
                                                files: [file],
                                                options,
                                                done: (opt: IDLTOptions) => {
                                                    opener
                                                        .file(file)
                                                        .dlt(opt)
                                                        .catch((err: Error) => {
                                                            console.error(
                                                                `Fail to open file; error: ${err.message}`,
                                                            );
                                                        });
                                                },
                                            },
                                        },
                                        active: true,
                                    });
                                })
                                .catch((err: Error) => {
                                    console.error(`Fail to select DLT file: ${err.message}`);
                                });
                        },
                    },
                    {
                        caption: 'Open file preset',
                        handler: () => {
                            bridge
                                .files()
                                .getByPath([filename])
                                .then((files: File[]) => {
                                    if (files.length !== 1) {
                                        return;
                                    }
                                    const file = files[0];
                                    session.add().tab({
                                        name: `Opening DLT file`,
                                        content: {
                                            factory: components.get('app-tabs-source-dltfile'),
                                            inputs: {
                                                files: [file],
                                                options,
                                                done: (opt: IDLTOptions) => {
                                                    opener
                                                        .file(file)
                                                        .dlt(opt)
                                                        .catch((err: Error) => {
                                                            console.error(
                                                                `Fail to open file; error: ${err.message}`,
                                                            );
                                                        });
                                                },
                                            },
                                        },
                                        active: true,
                                    });
                                })
                                .catch((err: Error) => {
                                    console.error(`Fail to select DLT file: ${err.message}`);
                                });
                        },
                    },
                ];
            }
        } else if (this.dlt_stream !== undefined) {
            const opt = this.dlt_stream;
            return [
                {
                    caption: 'Reconnect',
                    handler: this.apply.bind(this, remove),
                },
                {
                    caption: 'Open connection preset',
                    handler: () => {
                        opener
                            .stream(opt.source, true, undefined)
                            .dlt(opt.options)
                            .catch((err: Error) => {
                                console.error(`Fail to open stream; error: ${err.message}`);
                            });
                    },
                },
            ];
        } else if (this.text_stream !== undefined) {
            const opt = this.text_stream;
            return [
                {
                    caption: 'Restart',
                    handler: this.apply.bind(this, remove),
                },
                {
                    caption: 'Open start parameters',
                    handler: () => {
                        opener
                            .stream(opt.source, true, undefined)
                            .text()
                            .catch((err: Error) => {
                                console.error(`Fail to open stream; error: ${err.message}`);
                            });
                    },
                },
            ];
        }
        return [];
    }

    public apply(remove: (uuid: string[]) => void): void {
        (() => {
            if (this.file !== undefined) {
                if (this.file.text !== undefined) {
                    return opener.file(this.file.text.filename).text();
                } else if (this.file.dlt !== undefined) {
                    return opener.file(this.file.dlt.filename).dlt(this.file.dlt.options);
                } else {
                    return Promise.reject(new Error(`Opener for file action isn't found`));
                }
            } else if (this.dlt_stream !== undefined) {
                return opener
                    .stream(this.dlt_stream.source, undefined, undefined)
                    .dlt(this.dlt_stream.options);
            } else if (this.text_stream !== undefined) {
                return opener.stream(this.text_stream.source, undefined, undefined).text({});
            } else {
                return Promise.reject(new Error(`Opener for action isn't found`));
            }
        })().catch((err: Error) => {
            const message = lockers.lock(
                new Locker(false, `Fail to apply action via error: ${err.message}`)
                    .set()
                    .buttons([
                        {
                            caption: `Remove`,
                            handler: () => {
                                remove([this.uuid]);
                                message.popup.close();
                            },
                        },
                        {
                            caption: `Cancel`,
                            handler: () => {
                                message.popup.close();
                            },
                        },
                    ])
                    .end(),
                {
                    closable: false,
                },
            );
        });
    }
}
