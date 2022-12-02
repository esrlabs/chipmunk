import { Chart } from 'chart.js';
import { IPosition, IPositionChange } from '../service';
import { Owner } from '@schema/content/row';
import { getPropByPath } from '@platform/env/obj';
import { IRange } from '@platform/types/range';
import { AdvancedState, EChartName } from '../abstract/advanced';

export class State extends AdvancedState {
    private _range!: IRange;
    private _loading: boolean = true;

    public init() {
        this._subscribe();
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.sidebar.resize(this._resize.bind(this)),
            );
        this._parent.env().subscriber.register(this._service.onChange(this._onChange.bind(this)));
        this._onChange(this._service.getPosition(this._session.uuid()));
    }

    public destroy() {
        if (this._filters !== undefined) {
            this._filters.destroy();
        }
    }

    public noData(): boolean {
        return !this._loading && this._map.length <= 0;
    }

    public isLoading(): boolean {
        return this._loading;
    }

    public get filters(): Chart | undefined {
        return this._filters;
    }

    public onClick(event: MouseEvent) {
        if (event.target === undefined) {
            return;
        }
        let position: number | undefined = this._getPositionByChartPointData(event);
        if (position === undefined) {
            const streamLen: number = this._session.stream.len();
            const pos: IPosition = this._service.getPosition(this._session.uuid()).position;
            const width: number =
                pos.full === 0 ? this._element.getBoundingClientRect().width : pos.full;
            if (streamLen > width) {
                const rangeRate: number = streamLen / width;
                const rangeBegin: number = Math.floor(pos.left * rangeRate);
                const rangeEnd: number = Math.floor((pos.left + pos.width) * rangeRate);
                const rows = rangeEnd - rangeBegin;
                const rate: number = width / rows;
                const offsetX: number = event.offsetX;
                position = Math.floor(offsetX / rate) + rangeBegin;
            } else {
                if (this._range === undefined) {
                    return;
                }
                const rows = this._range.to - this._range.from;
                const rate: number = width / rows;
                const offsetX: number = event.offsetX;
                position = Math.floor(offsetX / rate) + this._range.from;
            }
        }
        this._session.cursor.select(position, Owner.Chart);
    }

    protected _resize() {
        this._parent.detectChanges();
    }

    protected _fetch(width: number): Promise<void> {
        this._loading = true;
        return this._session.search
            .getScaledMap(width)
            .then((map) => {
                this._map = map;
                this._labelCount = this._map.length;
                this._draw(EChartName.chartFilters);
            })
            .catch((err: Error) => {
                this._parent.log().error(err);
            })
            .finally(() => {
                this._loading = false;
            });
    }

    private _getPositionByChartPointData(event: MouseEvent): number | undefined {
        let position: number | undefined;
        // Chart for regex will be added later
        [this._filters].forEach((chart: Chart | undefined) => {
            if (position !== undefined || chart === undefined || event.x < chart.chartArea.left) {
                return;
            }
            // This feature of chartjs isn't documented well,
            // so that's why here we have many checks
            const e: any[] = chart.getElementsAtEventForMode(
                event,
                'nearest',
                { intersect: true },
                false,
            );
            if (!(e instanceof Array) || e.length === 0) {
                return;
            }
            let label: any = getPropByPath(e[0], '_model.label');
            if (label !== undefined) {
                position = parseInt(label.replace(/\s-\s\d*/gi, ''), 10);
            } else {
                label = getPropByPath(e[0], '_chart.tooltip._model.body');
                if (
                    label instanceof Array &&
                    label.length > 0 &&
                    label[0].lines instanceof Array &&
                    label[0].lines.length > 0
                ) {
                    label = typeof label[0].lines[0] === 'string' ? label[0].lines[0] : undefined;
                    if (label !== undefined) {
                        position = parseInt(
                            label.replace(/[()]/gi, '').replace(/,\s\d*/gi, ''),
                            10,
                        );
                    }
                }
            }
            if (position !== undefined && (isNaN(position) || !isFinite(position))) {
                position = undefined;
            }
        });
        return position;
    }

    private _onChange(event: IPositionChange) {
        if (event.session !== this._session.uuid()) {
            return;
        }
        this._fetch(this._element.getBoundingClientRect().width)
            .then(() => {
                let position = event.position;
                const size: number = this._map.length;
                if (size === 0) {
                    return;
                }
                if (!this._isPositionViable(position)) {
                    const width = this._element.getBoundingClientRect().width;
                    position = {
                        full: width,
                        left: 0,
                        width: width,
                    };
                }
                const rate: number = position.full / size;
                let range: IRange;
                if (rate > 1) {
                    range = {
                        from: 0,
                        to: size,
                    };
                } else {
                    const left: number = Math.floor(position.left / rate);
                    const width: number = Math.floor(position.width / rate);
                    range = {
                        from: left,
                        to: left + width,
                    };
                    range.to = range.to >= size ? size - 1 : range.to;
                }
                this._range = range;
                this._draw(EChartName.chartFilters, range);
            })
            .catch((err: Error) => {
                this._parent.log().error(err);
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
