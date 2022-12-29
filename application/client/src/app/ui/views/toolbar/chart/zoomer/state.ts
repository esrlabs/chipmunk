import { AdvancedState, EChartName } from '../abstract/advanced';
import { IRange } from '@platform/types/range';

export class State extends AdvancedState {
    public isCursorVisible: boolean = true;
    public _ng_rectWidth: number = -1;
    public _ng_rectLeft: number = 0;
    public readonly _ng_borderWidth: number = 2;

    private _width: number = 0;

    public init() {
        this._positionChangeSetup();
        this._resizeSidebar();
        this._subscribe();
        this._parent.env().subscriber.register(
            this._parent.ilc().channel.ui.sidebar.resize(() => {
                this._resizeSidebar();
                this._update();
            }),
        );
        this._resizeSidebar();
        this._fetch(this._width).catch((err: Error) => {
            this._parent.log().error(err.message);
        });
    }

    public destroy() {
        if (this._filters !== undefined) {
            this._filters.destroy();
        }
    }

    public noData(): boolean {
        let displayFilter: boolean = false;
        if (
            this._filters &&
            this._filters.data.datasets &&
            this._filters.data.datasets.length > 0
        ) {
            displayFilter = true;
        }
        return !displayFilter;
    }

    protected _resizeSidebar() {
        this._width = this._element.getBoundingClientRect().width;
    }

    protected _fetch(width: number): Promise<void> {
        return this._session.search
            .getScaledMap(width)
            .then((map) => {
                this._map = map;
                this._draw(EChartName.zoomerFilters);
                this._updateCursor();
            })
            .catch((err: Error) => {
                this._parent.log().error(err.message);
            });
    }

    private _updateCursor() {
        const prev: boolean = this.isCursorVisible;
        const streamSize: number = this._session.stream.len();
        if (streamSize > 0 && this._width < streamSize) {
            this.isCursorVisible = true;
        } else {
            this.isCursorVisible = false;
        }
        if (this.isCursorVisible !== prev) {
            if (this.isCursorVisible === false) {
                this._service.setPosition({
                    session: this._session.uuid(),
                    position: { full: 0, left: 0, width: 0 },
                });
            }
            this._parent.detectChanges();
        }
    }

    private _onPositionChange(range: IRange) {
        const linesDiff: number = range.to - range.from;
        const linesTotal: number = this._session.stream.len();
        const linesDiffPercent: number = linesDiff / linesTotal;
        const totalWidth: number = this._element.getBoundingClientRect().width;
        const fromPercent: number = range.from / linesTotal;
        const border: number = 2 * this._ng_borderWidth;

        this._ng_rectWidth = Math.round(linesDiffPercent * totalWidth);
        this._ng_rectLeft = Math.round(fromPercent * totalWidth);
        if (this._ng_rectLeft + this._ng_rectWidth + border > totalWidth) {
            this._ng_rectLeft = totalWidth - this._ng_rectWidth - border;
        }
        this._parent.detectChanges();
    }

    private _positionChangeSetup() {
        const initialFrame = this._session.cursor.frame().get();
        initialFrame !== undefined && this._onPositionChange(initialFrame);
        this._parent
            .env()
            .subscriber.register(
                this._session.cursor.subjects
                    .get()
                    .frame.subscribe(this._onPositionChange.bind(this)),
            );
    }
}
