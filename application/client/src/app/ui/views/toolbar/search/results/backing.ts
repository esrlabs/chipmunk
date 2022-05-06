import { Session } from '@service/session';
import { Service } from '@elements/scrollarea/controllers/service';
import { Range } from '@platform/types/range';
import { Row, Owner } from '@schema/content/row';

const SCROLLAREA_SERVICE = 'search_scroll_area_service';

export function getScrollAreaService(session: Session): Service {
    const restored = session.storage.get<Service>(SCROLLAREA_SERVICE);
    if (restored === undefined) {
        const service = new Service({
            setFrame: (range: Range) => {
                session.search.chunk(range).then((rows) => {
                    service.setRows({
                        rows: rows.map((row, i) => {
                            return new Row({
                                position: {
                                    stream: row.position,
                                    view: row.row,
                                },
                                content: row.content,
                                session,
                                owner: Owner.Search,
                                source: 0,
                            });
                        }),
                        range,
                    });
                });
            },
            getLen: (): number => {
                return session.search.len();
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
