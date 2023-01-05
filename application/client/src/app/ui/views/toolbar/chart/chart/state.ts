import { IPosition, IPositionChange } from '../service';
import { Owner } from '@schema/content/row';
import { IRange } from '@platform/types/range';
import { AdvancedState, EChartName } from '../abstract/advanced';

export class State extends AdvancedState {
    public crosshairLeft: number = 0;
    public tooltip: string = '';
    public tooltipTop: number = 0;
    public showLeftTooltip: boolean = true;

    private readonly _tooltipHeight: number = 10;
    private _tooltipTimeout: number = -1;
    private _mouseEnter: boolean = false;
    private _range!: IRange;
    private _loading: boolean = true;
    private _height: number = 0;

    public init() {
        this._subscribe();
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.sidebar.resize(this._resizeSidebar.bind(this)),
            );
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.toolbar.resize(this._resizeToolbar.bind(this)),
            );
        this._parent.env().subscriber.register(this._service.onChange(this._onChange.bind(this)));
        this._resizeSidebar();
        this._resizeToolbar();
        this._service.noData = this._session.search.len() <= 0;
        this._onChange(this._service.getPosition(this._session.uuid()));
    }

    public destroy() {
        if (this._filters !== undefined) {
            this._filters.destroy();
        }
    }

    public isLoading(): boolean {
        return this._loading;
    }

    public onClick(event: MouseEvent) {
        const position: number = this._calculatePosition(event);
        position >= 0 && this._session.cursor.select(position, Owner.Chart, undefined, undefined);
    }

    public onMouseMove(event: MouseEvent) {
        if (this._tooltipTimeout !== -1) {
            window.clearTimeout(this._tooltipTimeout);
        }
        this._tooltipTimeout = window.setTimeout(() => {
            const offsetX = event.offsetX;
            if (offsetX > 0) {
                this.crosshairLeft = offsetX;
                this.showLeftTooltip = offsetX <= this._width / 2;
            }
            if (event.offsetY > 0) {
                const difference: number = this._height - this._tooltipHeight * 2;
                if (event.offsetY >= difference) {
                    this.tooltipTop = difference;
                } else {
                    this.tooltipTop = event.offsetY;
                }
                const position: number = this._calculatePosition(event);
                this.tooltip = position >= 0 ? `${position}` : '';
            }
            this._tooltipTimeout = -1;
        });
    }

    public onMouseEnter(mouseEnter: boolean) {
        if (!mouseEnter) {
            this.tooltip = '';
        }
        this._mouseEnter = mouseEnter;
    }

    public showTooltip(): boolean {
        return this._mouseEnter && this.tooltip.trim() !== '';
    }

    protected _fetch(width: number, range: IRange): Promise<void> {
        if (this.noData) {
            return new Promise((resolve) => {
                this._map = [];
                resolve();
            });
        }
        this._loading = true;
        return this._session.search
            .getScaledMap(width, range)
            .then((map) => {
                this._map = map;
                this._draw(EChartName.chartFilters);
            })
            .catch((err: Error) => {
                this._parent.log().error(err.message);
            })
            .finally(() => {
                this._loading = false;
            });
    }

    private _resizeToolbar() {
        this._height = this._element.getBoundingClientRect().height;
    }

    private _calculatePosition(event: MouseEvent): number {
        if (event.target === undefined) {
            return -1;
        }
        let pos: IPosition = this._service.getPosition(this._session.uuid()).position;
        if (!this._isPositionViable(pos)) {
            pos = {
                left: 0,
                width: 0,
                full: this._width,
            };
        }
        const streamLen: number = this._session.stream.len();
        const width: number = pos.full === 0 ? this._width : pos.full;
        if (streamLen > width) {
            const rangeRate: number = streamLen / width;
            const rangeBegin: number = Math.floor(pos.left * rangeRate);
            const rangeEnd: number = Math.floor((pos.left + pos.width) * rangeRate);
            const rows = rangeEnd - rangeBegin;
            const rate: number = width / rows;
            const offsetX: number = event.offsetX;
            return Math.floor(offsetX / rate) + rangeBegin;
        } else {
            if (this._range === undefined) {
                return -1;
            }
            const rows = this._range.to - this._range.from;
            const rate: number = width / rows;
            const offsetX: number = event.offsetX;
            return Math.floor(offsetX / rate) + this._range.from;
        }
    }

    private _onChange(event: IPositionChange) {
        if (event.session !== this._session.uuid()) {
            return;
        }
        const streamLen: number = this._session.stream.len();
        const position: IPosition = this._isPositionViable(event.position)
            ? event.position
            : {
                  full: this._width,
                  left: 0,
                  width: this._width,
              };
        const range: IRange = {
            from: Math.round((position.left / position.full) * streamLen),
            to: Math.round(((position.left + position.width) / position.full) * streamLen),
        };
        range.to = range.to >= streamLen ? streamLen - 1 : range.to;
        this._range = range;
        this._fetch(this._width, range)
            .then(() => {
                this._map.length > 0 && this._draw(EChartName.chartFilters);
            })
            .catch((err: Error) => {
                this._parent.log().error(err.message);
            });
    }

    private _isPositionViable(position: IPosition): boolean {
        if (
            position.left === undefined ||
            position.width === undefined ||
            position.full === undefined ||
            position.left < 0 ||
            position.width <= 0 ||
            position.full <= 0 ||
            isNaN(position.left) ||
            isNaN(position.width) ||
            isNaN(position.full) ||
            !isFinite(position.left) ||
            !isFinite(position.width) ||
            !isFinite(position.full)
        ) {
            return false;
        }
        return true;
    }
}
