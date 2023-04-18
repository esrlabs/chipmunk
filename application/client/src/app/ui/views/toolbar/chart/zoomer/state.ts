import { BasicState } from '../abstract/basic';
import { EChartName, ILabelState, IRectangle } from '../types';
import { Zoom } from './zoom';
import { Chart } from './chart';
import { Filter } from './filter';

export class State extends BasicState {
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
    private _filter!: Filter;
    private _chart!: Chart;
    private _canvasWidth: number = 0;
    private _zoom!: Zoom;

    constructor() {
        super();
    }

    public init() {
        this._canvasWidth = this._element.getBoundingClientRect().width;
        this._filter = new Filter(
            this._session,
            this._parent,
            this._canvasWidth,
            this._dataState.filter,
        );
        this._chart = new Chart(this._session, this._parent, this._dataState.chart, this._service);
        this._zoom = new Zoom(this._session, this._parent, this._service, this._canvasWidth);
        this._initSubscriptions();
        this._updateCanvasWidth();
    }

    public destroy() {
        this._chart && this._chart.destroy();
        this._filter && this._filter.destroy();
    }

    public get rectangle(): IRectangle {
        return this._zoom
            ? this._zoom.rectangle
            : {
                  borderWidth: 1,
                  width: 0,
                  left: 0,
                  isCursorVisible: true,
              };
    }

    public get isCursorVisible(): boolean {
        return (
            !this.hasNoData &&
            (this._session ? this._canvasWidth < this._session.stream.len() : false)
        );
    }

    public get hasNoData(): boolean {
        return this._dataState.filter.hasNoData && this._dataState.chart.hasNoData;
    }

    private _initSubscriptions() {
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.sidebar.resize(this._updateCanvasWidth.bind(this)),
            );
    }

    private _updateCanvasWidth() {
        this._canvasWidth = this._element.getBoundingClientRect().width;
        this._zoom.canvasWidth = this._canvasWidth;
        this._filter.canvasWidth = this._canvasWidth;
    }
}
