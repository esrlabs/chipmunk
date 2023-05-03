import { IRange } from '@platform/types/range';
import { IRectangle } from './common/types';
import { AbstractState } from './common/abstract.state';

export class State extends AbstractState {
    private readonly _rectangle: IRectangle = {
        width: 0,
        left: 0,
    };
    private _shownRange: IRange = {
        from: 0,
        to: 0,
    };
    private _canvasWidth: number = 0;
    private _hasNoData: boolean = true;

    constructor() {
        super();
    }

    public init() {
        this._canvasWidth = this._element.getBoundingClientRect().width;
        this._updateCursor();
        this._positionChange(this._session.cursor.frame().get());
        this._parent
            .env()
            .subscriber.register(
                this._session.cursor.subjects
                    .get()
                    .frame.subscribe(this._positionChange.bind(this)),
                this._parent.ilc().channel.ui.sidebar.resize(this._updateCanvasWidth.bind(this)),
                this._parent.ilc().channel.ui.window.resize(this._updateCanvasWidth.bind(this)),
                this._service.subjects.hasNoData.subscribe(this._onHasNoData.bind(this)),
            );
    }

    public get rectangle(): IRectangle {
        return this._rectangle;
    }

    public get hasNoData(): boolean {
        return this._hasNoData;
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
        const border: number = 2;

        this._rectangle.width = Math.round(linesDiffPercent * this._canvasWidth);
        this._rectangle.left = Math.round(fromPercent * this._canvasWidth);
        if (this._rectangle.left + this._rectangle.width + border > this._canvasWidth) {
            this._rectangle.left = this._canvasWidth - this._rectangle.width - border;
        }
        this._parent.detectChanges();
    }

    private _updateCursor() {
        this._service.setPosition({
            session: this._session.uuid(),
            position: { full: this._canvasWidth, left: 0, width: this._canvasWidth },
        });
        this._parent.detectChanges();
    }

    private _onHasNoData(hasNoData: boolean) {
        this._hasNoData = hasNoData;
        this._parent.detectChanges();
    }

    private _updateCanvasWidth() {
        this._canvasWidth = this._element.getBoundingClientRect().width;
        this._positionChange();
    }

    // [TODO] Subscribe to window and sidebar change -> Adjust rectangle
}
