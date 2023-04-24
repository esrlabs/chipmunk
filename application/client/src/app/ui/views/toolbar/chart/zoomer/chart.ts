import { IlcInterface } from '@service/ilc';
import { Session } from '@service/session';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ChangesDetector } from '@ui/env/extentions/changes';
import {
    BubbleDataPoint,
    ChartDataset,
    ChartTypeRegistry,
    ScatterDataPoint,
    Chart as CanvasChart,
} from 'chart.js';
import { Service } from '../service';
import { EChartName, EScaleType, ILabel } from '../common/types';
import { StoredEntity } from '@service/session/dependencies/search/store';

export class Chart {
    private readonly _session: Session;
    private readonly _parent: IlcInterface & ChangesDetector;
    private readonly _chart: CanvasChart;
    private readonly _labelState: ILabel;
    private readonly _service: Service;

    constructor(
        session: Session,
        parent: IlcInterface & ChangesDetector,
        labelState: ILabel,
        service: Service,
    ) {
        this._session = session;
        this._parent = parent;
        this._labelState = labelState;
        this._service = service;
        this._chart = this._createChart();
        this._initSubscriptions();
        this._initDatasets();
        this._initData();
    }

    public destroy() {
        this._chart.destroy();
    }

    private _initSubscriptions() {
        this._parent
            .env()
            .subscriber.register(
                this._session.search
                    .store()
                    .charts()
                    .subjects.get()
                    .highlights.subscribe(this._onColorChange.bind(this)),
            );
        this._parent
            .env()
            .subscriber.register(
                this._session.search
                    .store()
                    .charts()
                    .subjects.get()
                    .value.subscribe(this._onChange.bind(this)),
            );
        this._parent
            .env()
            .subscriber.register(
                this._service.subjects.scaleType.subscribe(this._onScaleTypeChange.bind(this)),
            );
        this._parent
            .env()
            .subscriber.register(
                this._session.search.values.updated.subscribe(this._valuesUpdated.bind(this)),
            );
    }

    private _onChange(entities: ChartRequest[]) {
        this._removeRedundantDatasets(entities);
        entities.forEach((entity: ChartRequest) => {
            if (entity.definition.active) {
                const index: number = this._chart.data.datasets.findIndex((dataset) => {
                    return dataset.label === entity.definition.filter;
                });
                if (index === -1) {
                    this._chart.data.datasets.push({
                        label: entity.definition.filter,
                        data: [],
                        backgroundColor: entity.definition.color,
                        borderColor: entity.definition.color,
                        stepped: entity.definition.stepped,
                        spanGaps: true,
                        borderWidth: entity.definition.borderWidth,
                        tension: entity.definition.tension,
                        pointRadius: 0,
                    });
                    this._hideYAxes();
                    this._initData();
                } else {
                    const dataset: ChartDataset<'line', ScatterDataPoint[]> = this._chart.data
                        .datasets[index] as ChartDataset<'line', ScatterDataPoint[]>;
                    dataset.stepped = entity.definition.stepped;
                    dataset.borderWidth = entity.definition.borderWidth;
                    dataset.tension = entity.definition.tension;
                }
            }
        });
        this._chart.update();
        this._updateHasNoData();
    }

    private _onScaleTypeChange(type: EScaleType) {
        const options = this._chart.options;
        if (options !== undefined && options.scales !== undefined) {
            const scale = options.scales['y'];
            if (scale !== undefined) {
                scale.type = type;
            }
            this._chart.update();
        }
    }

    private _removeRedundantDatasets(entities: ChartRequest[]) {
        this._chart.data.datasets = this._chart.data.datasets.filter(
            (
                dataset: ChartDataset<
                    keyof ChartTypeRegistry,
                    (number | ScatterDataPoint | BubbleDataPoint | null)[]
                >,
            ) => {
                return (
                    entities.findIndex((entity: ChartRequest) => {
                        return (
                            entity.definition.filter === dataset.label && entity.definition.active
                        );
                    }) !== -1
                );
            },
        );
    }

    private _initDatasets() {
        this._chart.data.datasets = [];
        this._getActiveChartRequests().forEach(
            (activeChartRequest: ChartRequest, index: number) => {
                this._chart.data.datasets[index] = {
                    label: activeChartRequest.definition.filter,
                    data: [],
                    backgroundColor: activeChartRequest.definition.color,
                    borderColor: activeChartRequest.definition.color,
                    stepped: activeChartRequest.definition.stepped,
                    spanGaps: true,
                    borderWidth: activeChartRequest.definition.borderWidth,
                    tension: activeChartRequest.definition.tension,
                    pointRadius: 0,
                };
            },
        );
        this._hideYAxes();
    }

    private _initData() {
        if (this._getActiveChartRequests().length === 0) {
            this._updateHasNoData();
            return;
        }
        this._chart.data.labels = [];
        for (const [line, values] of this._session.search.values.get()) {
            Array.isArray(this._chart.data.labels) && this._chart.data.labels.push(line);
            values.forEach((value: string, id: number) => {
                if (this._chart.data.datasets[id] !== undefined) {
                    this._chart.data.datasets[id].data.push({
                        x: line,
                        y: parseInt(value),
                    });
                }
            });
        }
        this._chart.update();
        this._updateHasNoData();
    }

    private _hideYAxes() {
        if (this._chart.options.scales === undefined) {
            return;
        }
        this._chart.update();
        Object.keys(this._chart.options.scales).forEach((axis: string) => {
            const options = this._chart.options;
            if (options !== undefined && options.scales) {
                const scale = options.scales[axis];
                if (scale !== undefined) {
                    scale.display = false;
                }
            }
        });
    }

    private _createChart(): CanvasChart {
        return new CanvasChart(`${EChartName.zoomerCharts}-${this._session.uuid()}`, {
            type: 'line',
            data: {
                labels: [],
                datasets: [],
            },
            options: {
                plugins: {
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        enabled: false,
                    },
                },
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        display: false,
                        stacked: true,
                        beginAtZero: true,
                    },
                    x: {
                        stacked: true,
                        display: false,
                    },
                },
            },
        });
    }

    private _onColorChange(entities: ChartRequest[]) {
        entities.forEach((entity: ChartRequest) => {
            this._chart.data.datasets.forEach(
                (
                    dataset: ChartDataset<
                        keyof ChartTypeRegistry,
                        (number | ScatterDataPoint | BubbleDataPoint | null)[]
                    >,
                ) => {
                    if (dataset.label === entity.definition.filter) {
                        dataset.backgroundColor = entity.definition.color;
                        dataset.borderColor = entity.definition.color;
                    }
                },
            );
        });
        this._chart.update();
    }

    private _updateHasNoData() {
        this._labelState.hasNoData = true;
        this._chart.data.datasets.forEach(
            (
                dataset: ChartDataset<
                    keyof ChartTypeRegistry,
                    (number | ScatterDataPoint | BubbleDataPoint | null)[]
                >,
            ) => {
                if (dataset.data.length > 0) {
                    this._labelState.hasNoData = false;
                }
            },
        );
        this._parent.detectChanges();
    }

    private _getActiveChartRequests(): StoredEntity<ChartRequest>[] {
        return Array.from(
            this._session.search
                .store()
                .charts()
                .get()
                .filter((entity: ChartRequest) => entity.definition.active),
        );
    }

    private _valuesUpdated() {
        this._initDatasets();
        this._initData();
    }
}
