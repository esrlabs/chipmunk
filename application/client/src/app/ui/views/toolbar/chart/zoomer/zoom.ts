import { IRange } from '@platform/types/range';
import { IlcInterface } from '@service/ilc';
import { Session } from '@service/session';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Service } from '../service';
import { IRectangle } from '../common/types';

export class Zoom {
    private readonly _rectangle: IRectangle = {
        borderWidth: 1,
        width: 0,
        left: 0,
        isCursorVisible: true,
    };
    private readonly _session: Session;
    private readonly _parent: IlcInterface & ChangesDetector;
    private readonly _service: Service;
    private _shownRange: IRange = {
        from: 0,
        to: 0,
    };
    private _canvasWidth: number = 0;

    constructor(
        session: Session,
        parent: IlcInterface & ChangesDetector,
        service: Service,
        canvasWidth: number,
    ) {
        this._session = session;
        this._parent = parent;
        this._service = service;
        this._canvasWidth = canvasWidth;
        this._updateCursor();
        this._positionChange(this._session.cursor.frame().get());
        this._parent
            .env()
            .subscriber.register(
                this._session.cursor.subjects
                    .get()
                    .frame.subscribe(this._positionChange.bind(this)),
            );
    }

    public get rectangle(): IRectangle {
        return this._rectangle;
    }

    public set canvasWidth(canvasWidth: number) {
        this._canvasWidth = canvasWidth;
        this._positionChange();
    }

    private _positionChange(range?: IRange) {
        if (range !== undefined) {
            range.to += 1;
            this._shownRange = range;
        }
        const linesDiff: number = this._shownRange.to - this._shownRange.from;
        const linesTotal: number = this._session.stream.len();
        const linesDiffPercent: number = linesDiff / linesTotal;
        const fromPercent: number = this._shownRange.from / linesTotal;
        const border: number = 2 * this._rectangle.borderWidth;

        this._rectangle.width = Math.round(linesDiffPercent * this._canvasWidth);
        this._rectangle.left = Math.round(fromPercent * this._canvasWidth);
        if (this._rectangle.left + this._rectangle.width + border > this._canvasWidth) {
            this._rectangle.left = this._canvasWidth - this._rectangle.width - border;
        }
        this._parent.detectChanges();
    }

    private _updateCursor() {
        const streamSize: number = this._session.stream.len();
        this._rectangle.isCursorVisible = streamSize > 0 && this._canvasWidth < streamSize;
        !this._rectangle.isCursorVisible &&
            this._service.setPosition({
                session: this._session.uuid(),
                position: { full: this._canvasWidth, left: 0, width: this._canvasWidth },
            });
        this._parent.detectChanges();
    }
}
