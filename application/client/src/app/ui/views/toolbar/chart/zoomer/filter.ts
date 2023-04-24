import {
    BubbleDataPoint,
    Chart,
    ChartDataset,
    ChartTypeRegistry,
    ScatterDataPoint,
} from 'chart.js';
import { EChartName, ILabel } from '../common/types';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ISearchMap } from '@platform/interfaces/interface.rust.api.general';
import { Session } from '@service/session';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { IlcInterface } from '@service/ilc';
import { StoredEntity } from '@service/session/dependencies/search/store';

export class Filter {
    private readonly _session: Session;
    private readonly _parent: IlcInterface & ChangesDetector;
    private readonly _chart: Chart;
    private readonly _labelState: ILabel;
    private _canvasWidth: number;

    constructor(
        session: Session,
        parent: IlcInterface & ChangesDetector,
        canvasWidth: number,
        labelState: ILabel,
    ) {
        this._session = session;
        this._parent = parent;
        this._canvasWidth = canvasWidth;
        this._chart = this._createChart();
        this._labelState = labelState;
        this._initSubscriptions();
        this._initDatasets();
        this._initData();
    }

    public destroy() {
        this._chart.destroy();
    }

    public set canvasWidth(canvasWidth: number) {
        this._canvasWidth = canvasWidth;
        this._initData();
    }

    private _initSubscriptions() {
        this._parent
            .env()
            .subscriber.register(
                this._session.search
                    .store()
                    .filters()
                    .subjects.get()
                    .highlights.subscribe(this._onColorChange.bind(this)),
            );
        this._parent
            .env()
            .subscriber.register(
                this._session.search
                    .store()
                    .filters()
                    .subjects.get()
                    .value.subscribe(this._onChange.bind(this)),
            );
        this._parent
            .env()
            .subscriber.register(
                this._session.search.subjects.get().map.subscribe(this._mapUpdated.bind(this)),
            );
    }

    private _onChange(entities: FilterRequest[]) {
        this._removeRedundantDatasets(entities);
        entities.forEach(async (entity: FilterRequest) => {
            if (entity.definition.active) {
                const index: number = this._chart.data.datasets.findIndex((dataset) => {
                    return dataset.label === entity.definition.filter.filter;
                });
                if (index === -1) {
                    this._chart.data.datasets.push({
                        label: entity.definition.filter.filter,
                        data: [],
                        backgroundColor: entity.definition.colors.background,
                        borderColor: entity.definition.colors.background,
                    });
                    await this._initData();
                }
            }
        });
        this._chart.update();
        this._updateHasNoData();
    }

    private _removeRedundantDatasets(entities: FilterRequest[]) {
        this._chart.data.datasets = this._chart.data.datasets.filter(
            (
                dataset: ChartDataset<
                    keyof ChartTypeRegistry,
                    (number | ScatterDataPoint | BubbleDataPoint | null)[]
                >,
            ) => {
                return (
                    entities.findIndex((entity: FilterRequest) => {
                        return (
                            entity.definition.filter.filter === dataset.label &&
                            entity.definition.active
                        );
                    }) !== -1
                );
            },
        );
    }

    private _initDatasets() {
        this._chart.data.datasets = [];
        this._getActiveFilterRequests().forEach(
            (activeFilterRequest: FilterRequest, index: number) => {
                this._chart.data.datasets[index] = {
                    label: activeFilterRequest.definition.filter.filter,
                    data: [],
                    backgroundColor: activeFilterRequest.definition.colors.background,
                    borderColor: activeFilterRequest.definition.colors.background,
                };
            },
        );
    }

    private _initData(): Promise<void> {
        const streamLength: number = this._session.stream.len();
        return this._session.search
            .getScaledMap(streamLength <= this._canvasWidth ? streamLength : this._canvasWidth)
            .then((searchResults: ISearchMap) => {
                this._chart.data.labels = [];
                searchResults.forEach((idValues: number[][], line: number) => {
                    Array.isArray(this._chart.data.labels) && this._chart.data.labels.push(line);
                    line === 0 && this._resetDatasets();
                    this._fillDatasets(idValues, line);
                    this._stuffDatasetGaps(line);
                });
            })
            .catch((error: Error) => {
                this._parent
                    .log()
                    .error(`Failed to update filter zoom chart due to error: ${error.message}`);
            })
            .finally(() => {
                this._chart.update();
                this._updateHasNoData();
            });
    }

    private _createChart(): Chart {
        return new Chart(`${EChartName.zoomerFilters}-${this._session.uuid()}`, {
            type: 'bar',
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

    private _resetDatasets() {
        this._chart.data.datasets.forEach(
            (
                dataset: ChartDataset<
                    keyof ChartTypeRegistry,
                    (number | ScatterDataPoint | BubbleDataPoint | null)[]
                >,
            ) => {
                dataset.data = [];
            },
        );
    }

    private _fillDatasets(idValues: number[][], line: number) {
        idValues.forEach(([id, value]) => {
            if (line === 0) {
                this._chart.data.datasets[id].data = [];
            }
            this._chart.data.datasets[id].data.push(value);
        });
    }

    private _stuffDatasetGaps(line: number) {
        this._chart.data.datasets.forEach(
            (
                dataset: ChartDataset<
                    keyof ChartTypeRegistry,
                    (number | ScatterDataPoint | BubbleDataPoint | null)[]
                >,
            ) => {
                dataset.data[line] === undefined && dataset.data.push(0);
            },
        );
    }

    private _onColorChange(entities: FilterRequest[]) {
        entities.forEach((entity: FilterRequest) => {
            const entityColor: string = entity.definition.colors.background;
            this._chart.data.datasets.forEach(
                (
                    dataset: ChartDataset<
                        keyof ChartTypeRegistry,
                        (number | ScatterDataPoint | BubbleDataPoint | null)[]
                    >,
                ) => {
                    if (dataset.label === entity.definition.filter.filter) {
                        dataset.backgroundColor = entityColor;
                        dataset.borderColor = entityColor;
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

    private _getActiveFilterRequests(): StoredEntity<FilterRequest>[] {
        return Array.from(
            this._session.search
                .store()
                .filters()
                .get()
                .filter((entity: FilterRequest) => entity.definition.active),
        );
    }

    private _mapUpdated() {
        this._initDatasets();
        this._initData();
    }
}
