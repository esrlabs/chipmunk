import { Subscriber, Subject } from '@platform/env/subscription';
import { Destroy } from '@env/declarations';
import { Session } from '@service/session';
import { EScaleType, IPosition, IPositionChange } from './common/types';
import { Zoom } from './zoom';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';

const CHART_SERVICE = 'workspace_chart_service';

export class Service extends Subscriber implements Destroy {
    private _positions: Map<string, IPosition> = new Map();
    private readonly _subjects: {
        change: Subject<IPositionChange>;
        wheel: Subject<WheelEvent>;
        scaleType: Subject<EScaleType>;
    } = {
        change: new Subject<IPositionChange>(),
        wheel: new Subject<WheelEvent>(),
        scaleType: new Subject<EScaleType>(),
    };
    private _zoom!: Zoom;

    public static from(session: Session): Service {
        const restored = session.storage.get<Service>(CHART_SERVICE);
        if (restored === undefined) {
            const service = new Service();
            session.storage.set(CHART_SERVICE, service);
            return service;
        } else {
            return restored;
        }
    }

    public correction(session: string, width: number): IPosition | undefined {
        const position: IPosition | undefined = this._positions.get(session);
        if (position === undefined || position.full <= 0) {
            return;
        }
        const change: number = width / position.full;
        position.width = position.width * change;
        position.left = position.left * change;
        return position;
    }

    public setPosition(data: IPositionChange) {
        if (data.position === undefined) {
            return;
        }
        this._positions.set(data.session, data.position);
        this._subjects.change.emit(data);
    }

    public getPosition(session: string): IPosition | undefined {
        return this._positions.get(session);
    }

    public get wheel(): Subject<WheelEvent> {
        return this._subjects.wheel;
    }

    public get subjects() {
        return this._subjects;
    }

    public getZoom(
        session: Session,
        parent: IlcInterface & ChangesDetector,
        canvasWidth: number,
    ): Zoom {
        return this._zoom ? this._zoom : new Zoom(session, parent, this, canvasWidth);
    }

    public destroy() {
        this._subjects.change.destroy();
    }
}
