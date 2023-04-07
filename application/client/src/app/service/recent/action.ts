import { Recent as RecentFileAction, BaseInfo } from './implementations/file/file';
import { Recent as RecentStreamDltAction } from './implementations/stream/dlt';
import { Recent as RecentStreamTextAction } from './implementations/stream/text';

import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { unique } from '@platform/env/sequence';
import { TargetFileOptions, File } from '@platform/types/files';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition, SourceDefinitionHolder } from '@platform/types/transport';
import { opener } from '@service/opener';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { components } from '@env/decorators/initial';
import { lockers, Locker } from '@ui/service/lockers';
import { ParserName, Origin } from '@platform/types/observe';
import { Stat } from './stat';
import { recent } from '@service/recent';

import * as obj from '@platform/env/obj';

export type AfterHandler = () => void;

export class Action {
    public file: RecentFileAction | undefined;
    public dlt_stream: RecentStreamDltAction | undefined;
    public text_stream: RecentStreamTextAction | undefined;
    public stat: Stat = Stat.defaults();

    public uuid: string = unique();

    protected readonly handlers: {
        after: AfterHandler | undefined;
    } = {
        after: undefined,
    };

    public after(handler: AfterHandler | undefined): Action {
        this.handlers.after = handler;
        return this;
    }

    public isSuitable(origin: Origin | undefined, parser: ParserName | undefined): boolean {
        if (origin === undefined && parser === undefined) {
            return true;
        }
        if (origin !== undefined) {
            switch (origin) {
                case Origin.Stream:
                    if (this.file !== undefined) {
                        return false;
                    }
                    break;
                case Origin.File:
                    if (this.file === undefined) {
                        return false;
                    }
                    break;
                default:
                    return false;
            }
        }
        if (parser !== undefined) {
            switch (parser) {
                case ParserName.Text:
                    if (this.dlt_stream !== undefined) {
                        return false;
                    }
                    if (this.file !== undefined) {
                        return this.file.isSuitable(parser);
                    }
                    break;
                case ParserName.Dlt:
                    if (this.text_stream !== undefined) {
                        return false;
                    }
                    if (this.file !== undefined) {
                        return this.file.isSuitable(parser);
                    }
                    break;
                case ParserName.Someip:
                    return false;
                case ParserName.Pcap:
                    if (this.file === undefined) {
                        return false;
                    }
                    return this.file.isSuitable(parser);
            }
        }
        return true;
    }
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

    public as(): {
        source(): SourceDefinition | undefined;
        file(): BaseInfo | undefined;
        component(): IComponentDesc;
        entry(): Entry;
    } {
        return {
            source: (): SourceDefinition | undefined => {
                if (this.file !== undefined) {
                    return undefined;
                } else if (this.text_stream !== undefined) {
                    return this.text_stream.source;
                } else if (this.dlt_stream !== undefined) {
                    return this.dlt_stream.source;
                } else {
                    return undefined;
                }
            },
            file: (): BaseInfo | undefined => {
                if (this.file === undefined) {
                    return undefined;
                }
                return this.file.getBaseInfo();
            },
            component: (): IComponentDesc => {
                if (this.file !== undefined) {
                    return this.file.asComponent();
                } else if (this.dlt_stream !== undefined) {
                    return this.dlt_stream.asComponent();
                } else if (this.text_stream !== undefined) {
                    return this.text_stream.asComponent();
                } else {
                    throw new Error(`Unknonw type of action.`);
                }
            },
            entry: (): Entry => {
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
                body['stat'] = this.stat.asObj();
                return {
                    uuid: this.uuid,
                    content: JSON.stringify(body),
                };
            },
        };
    }

    public from(): {
        entry(entry: Entry): boolean;
        file(file: File, options: TargetFileOptions): Action;
        stream(source: SourceDefinition): {
            dlt(options: IDLTOptions): Action;
            text(): Action;
        };
    } {
        return {
            entry: (entry: Entry): boolean => {
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
                    const stat = Stat.from(action['stat']);
                    this.stat = stat.stat;
                    return stat.dropped;
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
                                    this.handlers.after !== undefined && this.handlers.after();
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
                                    this.handlers.after !== undefined && this.handlers.after();
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
                            .then(() => {
                                this.handlers.after !== undefined && this.handlers.after();
                            })
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
                            .then(() => {
                                this.handlers.after !== undefined && this.handlers.after();
                            })
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
        })()
            .then(() => {
                this.handlers.after !== undefined && this.handlers.after();
                recent.update([this]).catch((err: Error) => {
                    console.error(`Fail to update recent action: ${err.message}`);
                });
            })
            .catch((err: Error) => {
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

    public merge(action: Action): void {
        this.stat = action.stat;
        this.stat.update();
    }
}
