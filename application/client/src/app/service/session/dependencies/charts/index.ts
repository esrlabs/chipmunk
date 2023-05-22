import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subject, Subjects, Subscriber } from '@platform/env/subscription';
import {
    IValuesMap,
    IValuesMinMaxMap,
    ISearchMap,
} from '@platform/interfaces/interface.rust.api.general';
import { cutUuid } from '@log/index';
import { IRange } from '@platform/types/range';
import { Cursor } from './cursor';
import { Stream } from '../stream';
import { Search } from '../search';
import { FilterRequest } from '../search/filters/request';
import { ChartRequest } from '../search/charts/request';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

export interface Output {
    peaks: IValuesMinMaxMap;
    values: IValuesMap;
    map: ISearchMap;
    frame: IRange;
    filters: FilterRequest[];
    charts: ChartRequest[];
    // Selected chart
    selected: number | undefined;
}

@SetupLogger()
export class Charts extends Subscriber {
    public cursor: Cursor = new Cursor();
    public subjects: Subjects<{
        peaks: Subject<IValuesMinMaxMap>;
        output: Subject<Output>;
        summary: Subject<Output>;
    }> = new Subjects({
        peaks: new Subject<IValuesMinMaxMap>(),
        output: new Subject<Output>(),
        summary: new Subject<Output>(),
    });

    protected stream!: Stream;
    protected search!: Search;
    protected uuid!: string;
    protected peaks: IValuesMinMaxMap = {};
    protected lengths: {
        stream: number;
        search: number;
    } = {
        stream: 0,
        search: 0,
    };
    protected progress: {
        output: string | undefined;
        summary: string | undefined;
    } = {
        output: undefined,
        summary: undefined,
    };
    protected cache: {
        output: Output | undefined;
        summary: Output | undefined;
    } = {
        output: undefined,
        summary: undefined,
    };
    protected selected: string | undefined;

    protected reload(): {
        output(): void;
        summary(): void;
        both(): void;
        cached(): void;
        load(frame: IRange): Promise<Output>;
        defs(output: Output): Output;
        requests(): { filters: FilterRequest[]; charts: ChartRequest[] };
    } {
        return {
            output: (): void => {
                const frame = this.cursor.getFrame();
                if (frame === undefined) {
                    return;
                }
                if (this.progress.output !== undefined) {
                    return;
                }
                this.progress.output = this.cursor.hash();
                this.reload()
                    .load(frame)
                    .then((output) => {
                        this.cache.output = output;
                        this.subjects.get().output.emit(output);
                    })
                    .catch((err: Error) => {
                        this.log().error(
                            `Fail load output frame ${frame.from}-${frame.to}: ${err.message}`,
                        );
                    })
                    .finally(() => {
                        if (this.progress === undefined) {
                            return;
                        }
                        const reload = this.progress.output !== this.cursor.hash();
                        this.progress.output = undefined;
                        if (reload) {
                            this.reload().output();
                        }
                    });
            },
            summary: (): void => {
                const hash = () => {
                    return `${this.lengths.search};${
                        this.lengths.stream
                    };${this.cursor.getWidth()}`;
                };
                if (this.lengths.search === 0 && this.lengths.stream === 0) {
                    return;
                }
                if (this.progress.summary !== undefined) {
                    return;
                }
                const frame = { from: 0, to: this.lengths.stream };
                this.progress.summary = hash();
                this.reload()
                    .load(frame)
                    .then((output) => {
                        this.cache.summary = output;
                        this.subjects.get().summary.emit(output);
                    })
                    .catch((err: Error) => {
                        this.log().error(
                            `Fail load summary frame ${frame.from}-${frame.to}: ${err.message}`,
                        );
                    })
                    .finally(() => {
                        if (this.progress === undefined) {
                            return;
                        }
                        const reload = this.progress.summary !== hash();
                        this.progress.summary = undefined;
                        if (reload) {
                            this.reload().summary();
                        }
                    });
            },
            both: (): void => {
                this.reload().output();
                this.reload().summary();
            },
            cached: (): void => {
                if (this.cache.output !== undefined) {
                    this.subjects.get().output.emit(this.reload().defs(this.cache.output));
                } else {
                    this.reload().output();
                }
                if (this.cache.summary !== undefined) {
                    this.subjects.get().summary.emit(this.reload().defs(this.cache.summary));
                } else {
                    this.reload().summary();
                }
            },
            load: (frame: IRange): Promise<Output> => {
                return new Promise((resolve, reject) => {
                    const width = this.cursor.getWidth();
                    Promise.all([
                        this.scaled(width, frame).values(),
                        this.scaled(Math.floor(width / 2), frame).matches(),
                    ])
                        .then((results: [IValuesMap, ISearchMap]) => {
                            resolve(
                                this.reload().defs({
                                    peaks: this.peaks,
                                    values: results[0],
                                    map: results[1],
                                    frame,
                                    filters: [],
                                    charts: [],
                                    selected: undefined,
                                }),
                            );
                        })
                        .catch(reject);
                });
            },
            defs: (output: Output): Output => {
                const requests = this.reload().requests();
                output.filters = requests.filters;
                output.charts = requests.charts;
                output.selected = this.selecting().get();
                return output;
            },
            requests: (): { filters: FilterRequest[]; charts: ChartRequest[] } => {
                const active = this.search.state().getActive();
                return {
                    filters:
                        active === undefined
                            ? this.search
                                  .store()
                                  .filters()
                                  .get()
                                  .filter((f) => f.definition.active)
                            : [FilterRequest.fromDefinition(active)],
                    charts: this.search
                        .store()
                        .charts()
                        .get()
                        .filter((f) => f.definition.active),
                };
            },
        };
    }

    protected scaled(
        datasetLength: number,
        range?: IRange,
    ): {
        values(): Promise<IValuesMap>;
        matches(): Promise<ISearchMap>;
    } {
        return {
            values: (): Promise<IValuesMap> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Values.Frame.Response,
                        new Requests.Values.Frame.Request({
                            session: this.uuid,
                            width: datasetLength,
                            from: range !== undefined ? range.from : undefined,
                            to: range !== undefined ? range.to : undefined,
                        }),
                    )
                        .then((response) => {
                            resolve(response.values);
                        })
                        .catch(reject);
                });
            },
            matches: (): Promise<ISearchMap> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Search.Map.Response,
                        new Requests.Search.Map.Request({
                            session: this.uuid,
                            len: datasetLength,
                            from: range ? range.from : undefined,
                            to: range ? range.to : undefined,
                        }),
                    )
                        .then((response) => {
                            resolve(response.map);
                        })
                        .catch(reject);
                });
            },
        };
    }

    public init(uuid: string, stream: Stream, search: Search) {
        this.setLoggerName(`Values: ${cutUuid(uuid)}`);
        this.uuid = uuid;
        this.stream = stream;
        this.search = search;
        this.register(
            Events.IpcEvent.subscribe(Events.Values.Updated.Event, (event) => {
                if (event.session !== this.uuid) {
                    return;
                }
                this.peaks = event.map === null ? {} : event.map;
                this.subjects.get().peaks.emit(this.peaks);
                this.reload().both();
            }),
            this.stream.subjects.get().updated.subscribe((len) => {
                this.lengths.stream = len;
                this.reload().summary();
            }),
            this.search.subjects.get().updated.subscribe((event) => {
                this.lengths.search = event.found;
                this.reload().both();
            }),
            this.cursor.subjects.get().position.subscribe(() => {
                this.reload().output();
            }),
            this.cursor.subjects.get().width.subscribe(() => {
                this.reload().both();
            }),
            this.search
                .store()
                .filters()
                .subjects.get()
                .highlights.subscribe(() => {
                    this.reload().cached();
                }),
            this.search
                .store()
                .charts()
                .subjects.get()
                .highlights.subscribe(() => {
                    this.reload().cached();
                }),
        );
    }

    public destroy(): void {
        this.subjects.destroy();
        this.cursor.destroy();
        this.unsubscribe();
    }

    public getPeaks(): IValuesMinMaxMap {
        return this.peaks;
    }

    public refresh(): void {
        this.reload().cached();
    }

    public selecting(): {
        set(uuid: string | undefined): void;
        get(): number | undefined;
    } {
        return {
            set: (uuid: string | undefined): void => {
                this.selected = uuid;
                this.reload().cached();
            },
            get: (): number | undefined => {
                if (this.selected === undefined) {
                    return undefined;
                }
                const requests = this.reload().requests();
                const index = requests.charts.findIndex((f) => f.uuid() === this.selected);
                return index === -1 ? undefined : index;
            },
        };
    }
}
export interface Charts extends LoggerInterface {}
