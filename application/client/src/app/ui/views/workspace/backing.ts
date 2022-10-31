import { Session } from '@service/session';
import { Service } from '@elements/scrollarea/controllers/service';
import { Range } from '@platform/types/range';
import { Row, Owner } from '@schema/content/row';

const SCROLLAREA_SERVICE = 'workspace_scroll_area_service';

export function getScrollAreaService(session: Session): Service {
    const restored = session.storage.get<Service>(SCROLLAREA_SERVICE);
    if (restored === undefined) {
        const service = new Service({
            setFrame: (range: Range) => {
                session.stream.chunk(range).then((rows) => {
                    service.setRows({
                        rows: rows.map((row) => {
                            return new Row({
                                position: {
                                    stream: row.position,
                                    view: row.row,
                                },
                                content: row.content,
                                session,
                                owner: Owner.Output,
                                source:
                                    typeof row.source_id === 'string'
                                        ? parseInt(row.source_id, 10)
                                        : row.source_id,
                            });
                        }),
                        range,
                    });
                });
            },
            getLen: (): number => {
                return session.stream.len();
            },
            getItemHeight: (): number => {
                return 16;
            },
        });
        service.setLen(session.stream.len());
        return service;
    } else {
        restored.setLen(session.stream.len());
        return restored;
    }
}

export function setScrollAreaService(session: Session, service: Service) {
    session.storage.set(SCROLLAREA_SERVICE, service);
}
