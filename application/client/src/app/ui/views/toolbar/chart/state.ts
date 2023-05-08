import { AbstractState } from './common/abstract.state';

export class State extends AbstractState {
    private _canvasWidth: number = 0;
    private _hasNoData: boolean = true;

    constructor() {
        super();
    }

    public init() {
        this._canvasWidth = this._element.getBoundingClientRect().width;
        this._updateCursor();
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.sidebar.resize(this._updateCanvasWidth.bind(this)),
                this._parent.ilc().channel.ui.window.resize(this._updateCanvasWidth.bind(this)),
                this._service.subjects.hasNoData.subscribe(this._onHasNoData.bind(this)),
            );
    }

    public get hasNoData(): boolean {
        return this._hasNoData;
    }

    public onWheel(event: WheelEvent) {
        this._service.wheel.emit(event);
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
    }
}
