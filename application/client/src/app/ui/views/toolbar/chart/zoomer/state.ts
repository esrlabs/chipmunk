import { AdvancedState, EChartName } from '../abstract/advanced';

export class State extends AdvancedState {
    public isCursorVisible: boolean = true;

    private _width: number = 0;

    public init() {
        this._resize();
        this._subscribe();
        this._parent.env().subscriber.register(
            this._parent.ilc().channel.ui.sidebar.resize(() => {
                this._resize();
                this._update();
            }),
        );
        this._fetch(this._session.stream.len()).catch((err: Error) => {
            this._parent.log().error(err);
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

    protected _resize() {
        this._parent.detectChanges();
        this._width = this._element.getBoundingClientRect().width;
    }

    protected _fetch(width: number): Promise<void> {
        return this._session.search
            .getScaledMap(width)
            .then((map) => {
                this._map = map;
                this._labelCount = this._map.length;
                this._draw(EChartName.zoomerFilters);
                this._updateCursor();
            })
            .catch((err: Error) => {
                this._parent.log().error(err);
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
}
