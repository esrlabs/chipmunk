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
            if (this._session.search.len() === 0) {
                return resolve({
                    rows: this.getRows(this.cursor, []),
                    cursor: this.cursor,
                });
            } else {
                this._session.search
                    .chunk(range)
                    .then((rows) => {
                        resolve({
                            rows: this.getRows(this.cursor, rows),
                            cursor: this.cursor,
                        });
                    })
                    .catch(reject);
            }
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

    public getRows(cursor: number, rows: IGrabbedElement[]): Row[] {
        const first = this._session.search.map.getStreamPositionOn(cursor);
        if (first === undefined) {
            // There are nothing to inject
            return this.convert(rows);
        }
        const filtered: number[] = [];
        const streamLen = this._session.stream.len();
        const injections = this._session.cache
            .getRows()
            .concat(
                this._session.bookmarks
                    .get()
                    .filter((b) => b.stream() < streamLen)
                    .map((b, i) => b.as().grabbed(i)),
            )
            .filter((r) => {
                if (
                    r.position < first ||
                    filtered.indexOf(r.position) !== -1 ||
                    rows.find((g) => r.position === g.position) !== undefined
                ) {
                    return false;
                } else {
                    filtered.push(r.position);
                    return true;
                }
            });
        const mixed = rows
            .concat(injections)
            .filter((r) => r.position >= first)
            .map((r, i) => {
                r.row = i;
                return r;
            })
            .sort((a, b) => (a.position > b.position ? 1 : -1));
        return this.convert(mixed);
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
                    source:
                        typeof el.source_id === 'string'
                            ? parseInt(el.source_id, 10)
                            : el.source_id,
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
                const modified = (() => {
                    const len = session.search.len();
                    if (len === 0) {
                        return new Range(0, 0);
                    }
                    const from = session.search.map.getCorrectedPosition(range.from);
                    if (from === undefined) {
                        return range;
                    }
                    const to = from + getFrameLength();
                    return new Range(from, to < len ? to : len - 1);
                })();
                state
                    .get(modified)
                    .then((data) => {
                        setCursor(data.cursor);
                        service.setRows({
                            rows: data.rows,
                            range,
                        });
                        service.setLen(
                            session.search.len() + session.search.map.getInjectedCount(),
                        );
                    })
                    .catch((err: Error) => {
                        throw new Error(`Fail get chunk: ${err.message}`);
                    });
            },
            getLen: (): number => {
                return session.search.len() + session.search.map.getInjectedCount();
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
