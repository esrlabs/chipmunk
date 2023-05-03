import { AbstractState } from '../common/abstract.state';
import {
    IRectangle,
    EChartName,
    ILabelState,
    IPosition,
    IPositionChange,
    UPDATE_TIMEOUT_MS,
} from '../common/types';
import { IRange } from '@platform/types/range';
import { Owner } from '@schema/content/row';
import { Filter } from './filter';
import { Chart } from './chart';
import { Zoom } from '../zoom';

export class State extends AbstractState {
    public readonly EChartName = EChartName;

    private readonly _dataState: ILabelState = {
        filter: {
            hasNoData: true,
            loading: false,
        },
        chart: {
            hasNoData: true,
            loading: false,
        },
    };
    private readonly _timeout: {
        zoom: number;
        canvasWidth: number;
    } = {
        zoom: -1,
        canvasWidth: -1,
    };
    private _chart!: Chart;
    private _filter!: Filter;
    private _canvasWidth: number = 0;
    private _defaultPosition: IPosition = {
        full: this._canvasWidth,
        left: 0,
        width: this._canvasWidth,
    };
    private _zoomedRange!: IRange;
    private _zoom!: Zoom;

    constructor() {
        super();
    }

    public init() {
        this._canvasWidth = this._element.getBoundingClientRect().width;
        this._chart = new Chart(
            this._session,
            this._parent,
            this._service,
            this._canvasWidth,
            this._dataState.chart,
        );
        this._filter = new Filter(
            this._session,
            this._parent,
            this._service,
            this._canvasWidth,
            this._dataState.filter,
        );
        this._zoom = this._service.getZoom(this._session, this._parent, this._canvasWidth);
        this._initializeSubscriptions();
        this._onSidebarResize();
    }

    public destroy() {
        this._chart && this._chart.destroy();
        this._filter && this._filter.destroy();
    }

    public get isLoading(): boolean {
        return this._dataState.filter.loading || this._dataState.chart.loading;
    }

    public get hasNoData(): boolean {
        return this._dataState.filter.hasNoData && this._dataState.chart.hasNoData;
    }

    public onWheel(event: WheelEvent) {
        this._service.wheel.emit(event);
    }

    public onClick(event: MouseEvent) {
        const position: number = this._calculatePosition(event);
        position >= 0 && this._session.cursor.select(position, Owner.Chart, undefined, undefined);
    }

    public onContextMenu(event: MouseEvent) {
        this._parent.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: `Scale type: ${this._chart.reverseScaleType}`,
                    handler: () => {
                        this._service.subjects.scaleType.emit(this._chart.reverseScaleType);
                        this._chart.switchScaleType();
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }

    public get rectangle(): IRectangle {
        return this._zoom
            ? this._zoom.rectangle
            : {
                  width: 0,
                  left: 0,
              };
    }

    private _calculatePosition(event: MouseEvent): number {
        if (event.target === undefined) {
            return -1;
        }
        const pos: IPosition =
            this._service.getPosition(this._session.uuid()) ?? this._defaultPosition;
        const streamLen: number = this._session.stream.len();
        const width: number = pos.full === 0 ? this._canvasWidth : pos.full;
        if (streamLen > width) {
            const rangeRate: number = streamLen / width;
            const rangeBegin: number = Math.floor(pos.left * rangeRate);
            const rangeEnd: number = Math.floor((pos.left + pos.width) * rangeRate);
            const rows = rangeEnd - rangeBegin;
            const rate: number = width / rows;
            const offsetX: number = event.offsetX;
            return Math.floor(offsetX / rate) + rangeBegin;
        } else {
            if (this._zoomedRange === undefined) {
                return -1;
            }
            const rows = this._zoomedRange.to - this._zoomedRange.from;
            const rate: number = width / rows;
            const offsetX: number = event.offsetX;
            return Math.floor(offsetX / rate) + this._zoomedRange.from;
        }
    }

    private _initializeSubscriptions() {
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.sidebar.resize(this._onSidebarResize.bind(this)),
                this._service.subjects.change.subscribe(this._onZoomChange.bind(this)),
            );
    }

    private _onZoomChange(positionChange: IPositionChange) {
        if (positionChange.session !== this._session.uuid()) {
            return;
        }
        const streamLength: number = this._session.stream.len();
        const position: IPosition = positionChange.position ?? this._defaultPosition;
        this._zoomedRange = {
            from: Math.round((position.left / position.full) * streamLength),
            to: Math.round(((position.left + position.width) / position.full) * streamLength),
        };
        this._zoomedRange.to =
            this._zoomedRange.to >= streamLength ? streamLength - 1 : this._zoomedRange.to;
        this._timeout.zoom !== -1 && clearTimeout(this._timeout.zoom);
        this._timeout.zoom = window.setTimeout(() => {
            this._filter.zoom(this._zoomedRange);
            this._chart.zoom(this._zoomedRange);
            this._timeout.zoom = -1;
        }, UPDATE_TIMEOUT_MS);
    }

    private _onSidebarResize() {
        this._timeout.canvasWidth !== -1 && clearTimeout(this._timeout.canvasWidth);
        this._timeout.canvasWidth = window.setTimeout(() => {
            this._canvasWidth = this._element.getBoundingClientRect().width;
            this._filter.canvasWidth = this._canvasWidth;
            this._defaultPosition = {
                full: this._canvasWidth,
                left: 0,
                width: this._canvasWidth,
            };
            this._filter.zoom(this._zoomedRange);
            this._timeout.canvasWidth = -1;
        }, 150);
    }
}
