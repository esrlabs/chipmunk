import { Session } from '@service/session';
import { IRowsPacket, Service } from '@elements/scrollarea/controllers/service';
import { Range, IRange } from '@platform/types/range';
import { Row, Owner } from '@schema/content/row';

const SCROLLAREA_SERVICE = 'search_scroll_area_service';

function getRows(session: Session, range: Range | IRange): Promise<IRowsPacket> {
    return new Promise((resolve, reject) => {
        session.stream
            .grab(session.search.map.get().ranges(range instanceof Range ? range.get() : range))
            .then((elements) => {
                resolve({
                    rows: elements.map((el) => {
                        return new Row({
                            position: el.position,
                            content: el.content,
                            session: session,
                            owner: Owner.Search,
                            source:
                                typeof el.source_id === 'string'
                                    ? parseInt(el.source_id, 10)
                                    : el.source_id,
                        });
                    }),
                    range,
                });
            })
            .catch(reject);
    });
}

export function getScrollAreaService(session: Session): Service {
    const restored = session.storage.get<Service>(SCROLLAREA_SERVICE);
    if (restored === undefined) {
        const map = session.search.map;
        const service = new Service({
            getRows: (range: Range) => {
                return getRows(session, range);
            },
            setFrame: (range: Range) => {
                getRows(session, range)
                    .then((packet) => {
                        service.setRows(packet);
                        service.setLen(map.len());
                    })
                    .catch((err: Error) => {
                        throw new Error(`Fail get search chunk: ${err.message}`);
                    });
            },
            getLen: (): number => {
                return map.len();
            },
            getItemHeight: (): number => {
                return 16;
            },
        });
        service.setLen(map.len());
        return service;
    } else {
        restored.setLen(session.search.map.len());
        return restored;
    }
}

export function setScrollAreaService(session: Session, service: Service) {
    session.storage.set(SCROLLAREA_SERVICE, service);
}
