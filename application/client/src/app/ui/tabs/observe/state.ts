import { Observe, Parser } from '@platform/types/observe';
import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subjects, Subject } from '@platform/env/subscription';
import { File } from '@platform/types/files';
import { bytesToStr } from '@env/str';
import { Action } from './action';

import * as StreamOrigin from '@platform/types/observe/origin/stream/index';
import * as Origin from '@platform/types/observe/origin/index';
import * as FileOrigin from '@platform/types/observe/origin/file';
import * as ConcatOrigin from '@platform/types/observe/origin/concat';

export class State {
    public parsers: Parser.Reference[] = [];
    public parser: Parser.Protocol | undefined;
    public streams: StreamOrigin.Reference[] = [];
    public file: File | undefined;
    public concat: File[] | undefined;
    public stream: StreamOrigin.Source | undefined;
    public size: string | undefined;
    public action: Action = new Action();
    public updates: Subjects<{
        parser: Subject<void>;
        stream: Subject<void>;
    }> = new Subjects({
        parser: new Subject<void>(),
        stream: new Subject<void>(),
    });

    constructor(
        protected readonly ref: IlcInterface & ChangesDetector,
        public readonly observe: Observe,
    ) {
        this.update().stream();
        this.update().files();
        this.update().parser();
    }

    public destroy() {
        this.updates.destroy();
    }

    public update(): {
        stream(): void;
        files(): void;
        parser(): void;
    } {
        return {
            stream: (): void => {
                const prev = this.stream;
                if (this.observe.origin.configuration.Stream === undefined) {
                    this.streams = [];
                    this.stream = undefined;
                } else {
                    const current = this.stream;
                    this.streams = this.observe.parser.getSupportedStream();
                    this.stream =
                        current !== undefined &&
                        this.streams.find((p) => p.alias() === current) !== undefined
                            ? current
                            : this.streams[0].alias();
                }
                this.ref.markChangesForCheck();
                prev !== this.stream && this.updates.get().stream.emit();
            },
            files: (): void => {
                const instance = this.observe.origin.instance;
                const files: string[] | undefined =
                    instance instanceof FileOrigin.Configuration
                        ? [instance.filename()]
                        : instance instanceof ConcatOrigin.Configuration
                        ? instance.files()
                        : undefined;
                if (files === undefined) {
                    return;
                }
                this.ref
                    .ilc()
                    .services.system.bridge.files()
                    .getByPath(files)
                    .then((files: File[]) => {
                        this.size = bytesToStr(
                            files
                                .map((f) => f.stat.size)
                                .reduce((partialSum, a) => partialSum + a, 0),
                        );
                        if (instance instanceof FileOrigin.Configuration) {
                            if (files.length !== 1) {
                                this.ref
                                    .log()
                                    .error(
                                        `Expecting only 1 file stats. Has been gotten: ${files.length}`,
                                    );
                                return;
                            }
                            this.file = files[0];
                        } else if (instance instanceof ConcatOrigin.Configuration) {
                            this.concat = files;
                        }
                    })
                    .catch((err: Error) => {
                        this.ref
                            .log()
                            .error(
                                `Fail to get stats for files: ${files.join(', ')}: ${err.message}`,
                            );
                    })
                    .finally(() => {
                        this.ref.markChangesForCheck();
                    });
            },
            parser: (): void => {
                const current = this.parser;
                this.parsers = this.observe.origin.getSupportedParsers();
                this.parser =
                    current !== undefined &&
                    this.parsers.find((p) => p.alias() === current) !== undefined
                        ? current
                        : this.parsers[0].alias();
                this.ref.markChangesForCheck();
                current !== this.parser && this.updates.get().parser.emit();
            },
        };
    }

    public change(): {
        stream(): void;
        parser(): void;
    } {
        return {
            stream: (): void => {
                if (this.stream === undefined) {
                    this.ref.log().error(`Stream cannot be changed, because it's undefined`);
                    return;
                }
                const instance = this.observe.origin.instance;
                if (!(instance instanceof Origin.Stream.Configuration)) {
                    this.ref.log().error(`Stream cannot be changed, because origin isn't Stream`);
                    return;
                }
                instance.change(StreamOrigin.getByAlias(this.stream));
                this.updates.get().stream.emit();
                this.update().parser();
            },
            parser: (): void => {
                if (this.parser === undefined) {
                    this.ref.log().error(`Parser cannot be changed, because it's undefined`);
                    return;
                }
                this.observe.parser.change(Parser.getByAlias(this.parser));
                this.updates.get().parser.emit();
                this.update().stream();
            },
        };
    }
}
