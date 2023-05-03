import { AbstractState } from '../common/abstract.state';
import { EChartName, ILabelState } from '../common/types';
import { Chart } from './chart';
import { Filter } from './filter';

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
    private _filter!: Filter;
    private _chart!: Chart;
    private _canvasWidth: number = 0;

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
        this._initSubscriptions();
        this._updateCanvasWidth();
    }

    public destroy() {
        this._chart && this._chart.destroy();
        this._filter && this._filter.destroy();
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
        this._filter.canvasWidth = this._canvasWidth;
    }
}
