import { Session } from '@service/session';
import { Service } from '@elements/scrollarea/controllers/service';
import { Range } from '@platform/types/range';
import { Row, Owner } from '@schema/content/row';
import { IGrabbedElement } from '@platform/types/content';

const SCROLLAREA_SERVICE = 'search_scroll_area_service';

class State {
    protected prev: Range | undefined;
    protected cursor: number = 0;
    protected len: number = 0;

    private readonly _session: Session;

    constructor(session: Session) {
        this._session = session;
    }

    public get(range: Range): Promise<{ rows: Row[]; cursor: number }> {
        return new Promise((resolve, reject) => {
            const cursor = this.cursor;
            const len = this._session.search.len();
            const extended = new Range(
                range.from - this.len > 0 ? range.from - this.len : 0,
                range.to + 1 > len - 1 ? (len > 0 ? len - 1 : range.to) : range.to + 1,
            );
            this._session.search
                .chunk(extended)
                .then((rows) => {
                    const data = this.getRows(cursor, rows);
                    resolve({
                        rows: data.rows,
                        cursor: this.cursor - data.injected > 0 ? this.cursor - data.injected : 0,
                    });
                })
                .catch(reject);
        });
    }

    public update(range: Range) {
        if (this.prev === undefined) {
            this.prev = range;
            return;
        }
        this.cursor += range.from - this.prev.from;
        this.prev = range;
    }

    public getRows(cursor: number, rows: IGrabbedElement[]): { rows: Row[]; injected: number } {
        if (rows.length === 0) {
            return {
                rows: this.convert(this._session.bookmarks.get().map((b, i) => b.as().grabbed(i))),
                injected: this._session.bookmarks.get().length,
            };
        } else {
            let injected = 0;
            const elements: IGrabbedElement[] = [];
            rows.forEach((current: IGrabbedElement, i: number) => {
                const next: IGrabbedElement | undefined = rows[i + 1];
                if (i === 0) {
                    // Insert bookmarks before range
                    const bookmarks = this._session.bookmarks
                        .get(new Range(current.position, current.position).before(true))
                        .filter((b) => b.stream() !== current.position);
                    elements.push(...bookmarks.map((b) => b.as().grabbed(0)));
                }
                if (next !== undefined) {
                    // Insert bookmarks between current and next
                    const bookmarks = this._session.bookmarks
                        .get(new Range(current.position, next.position).left(false).right(false))
                        .filter((b) => b.stream() !== current.position);
                    elements.push(current);
                    elements.push(...bookmarks.map((b) => b.as().grabbed(0)));
                    injected += bookmarks.length;
                }
                if (next === undefined) {
                    // Insert bookmarks after range
                    const bookmarks = this._session.bookmarks
                        .get(new Range(current.position, current.position).after(true))
                        .filter((b) => b.stream() !== current.position);
                    elements.push(...bookmarks.map((b) => b.as().grabbed(0)));
                }
            });
            // Correct indexes
            const row = rows[0].row;
            elements.forEach((el, i) => {
                el.row = row + i;
            });
            const first = elements.findIndex((r) => r.row === cursor);
            if (first === -1) {
                throw new Error(`Fail to find the first item`);
            }
            elements.splice(0, first);
            return {
                rows: this.convert(elements),
                injected,
            };
        }
    }

    public convert(elements: IGrabbedElement[]): Row[] {
        return elements.map(
            (el) =>
                new Row({
                    position: {
                        stream: el.position,
                        view: el.row,
                    },
                    content: el.content,
                    session: this._session,
                    owner: Owner.Search,
                    source: 0,
                }),
        );
    }

    public setFrameLength(len: number) {
        this.len = len;
    }
}

export function getScrollAreaService(session: Session): Service {
    const restored = session.storage.get<Service>(SCROLLAREA_SERVICE);
    if (restored === undefined) {
        const state = new State(session);
        const service = new Service({
            setFrame: (
                range: Range,
                cursor: number,
                setCursor: (value: number) => void,
                getFrameLength: () => number,
            ) => {
                state.setFrameLength(getFrameLength());
                state.update(range);
                state
                    .get(range)
                    .then((data) => {
                        setCursor(data.cursor);
                        service.setRows({
                            rows: data.rows,
                            range,
                        });
                        service.setLen(session.search.len() + session.bookmarks.count());
                    })
                    .catch((err: Error) => {
                        console.error(err);
                        throw new Error(`Fail get chunk: ${err.message}`);
                    });
            },
            getLen: (): number => {
                return session.search.len() + session.bookmarks.count();
            },
            getItemHeight: (): number => {
                return 16;
            },
        });
        service.setLen(session.search.len());
        return service;
    } else {
        restored.setLen(session.search.len());
        return restored;
    }
}

export function setScrollAreaService(session: Session, service: Service) {
    session.storage.set(SCROLLAREA_SERVICE, service);
}
