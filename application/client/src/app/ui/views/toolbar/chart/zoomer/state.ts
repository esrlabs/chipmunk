import { IRange } from '@platform/types/range';
import { AbstractState } from '../common/abstract.state';
import { EChartName, ILabelState, IRectangle } from '../common/types';
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
    private readonly _rectangle: IRectangle = {
        width: 0,
        left: 0,
    };
    private _shownRange: IRange = {
        from: 0,
        to: 0,
    };

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
        this._onResize();
        this._updateOverviewRectangle(this._session.cursor.frame().get());
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

    public get rectangle(): IRectangle {
        return this._rectangle;
    }

    private _initSubscriptions() {
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.sidebar.resize(this._onResize.bind(this)),
                this._parent.ilc().channel.ui.window.resize(this._onResize.bind(this)),
                this._session.cursor.subjects
                    .get()
                    .frame.subscribe(this._updateOverviewRectangle.bind(this)),
            );
    }

    private _updateOverviewRectangle(range?: IRange) {
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

    private _onResize() {
        this._canvasWidth = this._element.getBoundingClientRect().width;
        this._filter.canvasWidth = this._canvasWidth;
        this._updateOverviewRectangle();
    }
}
