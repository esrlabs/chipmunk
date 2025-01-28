import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { IndexingMode } from '@platform/types/content';
import { Range, IRange } from '@platform/types/range';
import { GrabbedElement } from '@platform/types/bindings/miscellaneous';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class Indexed extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<number>;
        changed: Subject<void>;
    }> = new Subjects({
        updated: new Subject<number>(),
        changed: new Subject<void>(),
    });
    private _len: number = 0;
    private _uuid!: string;
    private _mode: IndexingMode = IndexingMode.Regular;

    public init(uuid: string) {
        this.setLoggerName(`Indexed: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this.register(
            Events.IpcEvent.subscribe(Events.Stream.IndexedMapUpdated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._len = event.len;
                this.subjects.get().updated.emit(this._len);
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public len(): number {
        return this._len;
    }

    public expand(row: number): {
        before(): Promise<void>;
        after(): Promise<void>;
    } {
        const request = (row: number, above: boolean): Promise<void> => {
            return Requests.IpcRequest.send(
                Requests.Stream.Expand.Response,
                new Requests.Stream.Expand.Request({
                    session: this._uuid,
                    seporator: row,
                    offset: 4,
                    above,
                }),
            )
                .then((response: Requests.Stream.Expand.Response) => {
                    if (typeof response.error === 'string') {
                        this.log().error(
                            `Fail to expand indexed content on position ${row}: ${response.error}`,
                        );
                    }
                })
                .catch((error: Error) => {
                    this.log().error(
                        `Fail to expand indexed content on position ${row}: ${error.message}`,
                    );
                })
                .finally(() => {
                    this.subjects.get().changed.emit();
                });
        };
        return {
            before: (): Promise<void> => {
                if (this._len === 0) {
                    return Promise.resolve();
                }
                return request(row, true);
            },
            after: (): Promise<void> => {
                if (this._len === 0) {
                    return Promise.resolve();
                }
                return request(row, false);
            },
        };
    }

    public grab(range: Range | IRange): Promise<GrabbedElement[]> {
        if (this._len === 0) {
            // TODO: Grabber is crash session in this case... should be prevented on grabber level
            return Promise.resolve([]);
        }
        return Requests.IpcRequest.send(
            Requests.Stream.Indexed.Response,
            new Requests.Stream.Indexed.Request({
                session: this._uuid,
                from: range.start,
                to: range.end,
            }),
        )
            .then((response: Requests.Stream.Indexed.Response) => {
                return response.rows;
            })
            .catch((error: Error) => {
                if (range.end >= this.len()) {
                    // It might be, during request search map has been changed already
                    // For example we requested range, but right after it, a new search
                    // was created and length of stream became 0
                    // In this case we don't need to log any errors, but on backend error
                    // will be logged in any way.
                } else {
                    this.log().error(`Fail to grab indexed content: ${error.message}`);
                }
                return [];
            });
    }

    public asRanges(): Promise<IRange[]> {
        if (this._len === 0) {
            return Promise.resolve([]);
        }
        return Requests.IpcRequest.send(
            Requests.Stream.IndexesAsRanges.Response,
            new Requests.Stream.IndexesAsRanges.Request({
                session: this._uuid,
            }),
        ).then((response: Requests.Stream.IndexesAsRanges.Response) => {
            return response.ranges;
        });
    }

    public getIndexesAround(
        row: number,
    ): Promise<{ before: number | undefined; after: number | undefined }> {
        if (this._len === 0) {
            return Promise.resolve({ before: undefined, after: undefined });
        }
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Stream.IndexesAround.Response,
                new Requests.Stream.IndexesAround.Request({
                    session: this._uuid,
                    row,
                }),
            )
                .then((response: Requests.Stream.IndexesAround.Response) => {
                    if (typeof response.error === 'string') {
                        return reject(new Error(response.error));
                    }
                    resolve({ before: response.before, after: response.after });
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to get distances around index ${row}: ${error.message}`);
                });
        });
    }

    public modes(): {
        regular(): boolean;
        breadcrumbs(): boolean;
        toggle(): {
            regular(): Promise<void>;
            breadcrumbs(): Promise<void>;
        };
    } {
        const request = (mode: IndexingMode): Promise<void> => {
            return Requests.IpcRequest.send(
                Requests.Stream.Mode.Response,
                new Requests.Stream.Mode.Request({
                    session: this._uuid,
                    mode,
                }),
            )
                .then((response: Requests.Stream.Mode.Response) => {
                    if (response.error !== undefined) {
                        this.log().warn(`Fail to switch indexing mode: ${response.error}`);
                    }
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to switch indexing mode: ${error.message}`);
                })
                .finally(() => {
                    this.subjects.get().changed.emit();
                });
        };
        return {
            regular: (): boolean => {
                return this._mode === IndexingMode.Regular;
            },
            breadcrumbs: (): boolean => {
                return this._mode === IndexingMode.Breadcrumbs;
            },
            toggle: (): {
                regular(): Promise<void>;
                breadcrumbs(): Promise<void>;
            } => {
                return {
                    regular: (): Promise<void> => {
                        this._mode = IndexingMode.Regular;
                        return request(this._mode);
                    },
                    breadcrumbs: (): Promise<void> => {
                        this._mode =
                            this._mode === IndexingMode.Regular
                                ? IndexingMode.Breadcrumbs
                                : IndexingMode.Regular;
                        return request(this._mode);
                    },
                };
            },
        };
    }
}
export interface Indexed extends LoggerInterface {}
