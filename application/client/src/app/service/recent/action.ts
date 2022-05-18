import { Recent as RecentFileAction } from './implementations/file/file';
import { Recent as RecentStreamDltAction } from './implementations/stream/dlt';

import { IComponentDesc } from '@ui/elements/containers/dynamic/component';
import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/env/logger';
import { unique } from '@platform/env/sequence';
import { TargetFileOptions, File } from '@platform/types/files';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition, SourceDefinitionHolder } from '@platform/types/transport';

import * as obj from '@platform/env/obj';

export class Action {
    public file: RecentFileAction | undefined;
    public dlt_stream: RecentStreamDltAction | undefined;

    public uuid: string = unique();

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
}
