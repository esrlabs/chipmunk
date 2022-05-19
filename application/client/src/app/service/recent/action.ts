import { Recent as RecentFileAction } from './implementations/file/file';
import { Recent as RecentStreamDltAction } from './implementations/stream/dlt';

import { IComponentDesc } from '@ui/elements/containers/dynamic/component';
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

import * as obj from '@platform/env/obj';

export class Action {
    public file: RecentFileAction | undefined;
    public dlt_stream: RecentStreamDltAction | undefined;

    public uuid: string = unique();

    public description(): {
        major: string;
        minor: string;
    } {
        if (this.file !== undefined) {
            return this.file.description();
        } else if (this.dlt_stream !== undefined) {
            return this.dlt_stream.description();
        } else {
            throw new Error(`Unknonw type of action.`);
        }
    }

    public asComponent(): IComponentDesc {
        if (this.file !== undefined) {
            return this.file.asComponent();
        } else if (this.dlt_stream !== undefined) {
            return this.dlt_stream.asComponent();
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
                };
            },
        };
    }

    public getActions(): Array<{ caption?: string; handler?: () => void }> {
        if (this.file !== undefined) {
            if (this.file.text !== undefined) {
                return [
                    {
                        caption: 'Reopen file',
                        handler: this.apply.bind(this),
                    },
                ];
            } else if (this.file.dlt !== undefined) {
                const filename = this.file.dlt.filename;
                const options = this.file.dlt.options;
                return [
                    {
                        caption: 'Reopen file',
                        handler: this.apply.bind(this),
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
                                    session.add().tab({
                                        name: `Opening DLT file`,
                                        content: {
                                            factory: components.get('app-tabs-source-dltfile'),
                                            inputs: {
                                                file: files[0],
                                                options,
                                                done: (opt: IDLTOptions) => {
                                                    opener
                                                        .file(files[0])
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
                                    session.add().tab({
                                        name: `Opening DLT file`,
                                        content: {
                                            factory: components.get('app-tabs-source-dltfile'),
                                            inputs: {
                                                file: files[0],
                                                options,
                                                done: (opt: IDLTOptions) => {
                                                    opener
                                                        .file(files[0])
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
                    handler: this.apply.bind(this),
                },
                {
                    caption: 'Open connection preset',
                    handler: () => {
                        opener
                            .stream()
                            .dlt(opt, true)
                            .catch((err: Error) => {
                                console.error(`Fail to open stream; error: ${err.message}`);
                            });
                    },
                },
            ];
        }
        return [];
    }

    public apply() {
        if (this.file !== undefined) {
            if (this.file.text !== undefined) {
                opener
                    .file(this.file.text.filename)
                    .text()
                    .catch((err: Error) => {
                        console.error(`Fail to open file; error: ${err.message}`);
                    });
            } else if (this.file.dlt !== undefined) {
                opener
                    .file(this.file.dlt.filename)
                    .dlt(this.file.dlt.options)
                    .catch((err: Error) => {
                        console.error(`Fail to open file; error: ${err.message}`);
                    });
            }
        } else if (this.dlt_stream !== undefined) {
            opener
                .stream()
                .dlt({ source: this.dlt_stream.source, options: this.dlt_stream.options })
                .catch((err: Error) => {
                    console.error(`Fail to open stream; error: ${err.message}`);
                });
        }
    }
}
