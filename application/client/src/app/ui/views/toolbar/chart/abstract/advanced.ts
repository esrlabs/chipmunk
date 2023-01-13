import { ISearchMap } from '@platform/interfaces/interface.rust.api.general';
import { IRange } from '@platform/types/range';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { StoredEntity } from '@service/session/dependencies/search/store';
import { Chart, ChartDataset } from 'chart.js';
import { BasicState } from './basic';
import { scheme_color_match } from '@styles/colors';

export enum EChartName {
    chartFilters = 'view-chart-canvas-filters',
    zoomerFilters = 'view-chart-zoomer-filters-canvas',
}

export abstract class AdvancedState extends BasicState {
    protected _filters: Chart | undefined;
    protected _datasets: ChartDataset<'bar', number[]>[] = [];
    protected _map: ISearchMap = [];
    protected _width: number = 0;

    private _drawTimeout: number = -1;

    public get filters(): Chart | undefined {
        return this._filters;
    }

    public get noData(): boolean {
        return this._service === undefined ? true : this._service.noData;
    }

    protected abstract override init(): void;

    protected abstract override destroy(): void;

    protected abstract _fetch(width: number, range?: IRange): Promise<void>;

    protected _resizeSidebar() {
        this._width = this._element.getBoundingClientRect().width;
    }

    protected _subscribe(): void {
        this._parent
            .env()
            .subscriber.register(
                this._session.search.subjects.get().updated.subscribe(this._update.bind(this)),
            );
        this._parent.env().subscriber.register(
            this._session.search
                .store()
                .filters()
                .subjects.get()
                .highlights.subscribe((entities: StoredEntity<FilterRequest>[]) => {
                    this._changeColors(entities);
                }),
        );
    }

    protected _update(): void {
        if (this._session !== undefined && this._session.search.len() <= 0) {
            this._service.noData = true;
            this._parent.detectChanges();
            return;
        }
        this._service.noData = false;
        this._fetch(this._width).catch((err: Error) => {
            this._parent.log().error(err.message);
        });
    }

    protected _draw(chartName: EChartName): void {
        if (this._drawTimeout !== -1) {
            window.clearTimeout(this._drawTimeout);
        }
        this._drawTimeout = window.setTimeout(() => {
            const checkForData: boolean = chartName === EChartName.zoomerFilters;
            this._extractData(checkForData);
            if (this._filters === undefined) {
                this._createChart(chartName);
            } else {
                this._filters.data = {
                    datasets: this._datasets,
                    labels: new Array(this._map.length).fill(''),
                };
                this._filters.update();
            }
            this._parent.detectChanges();
            this._drawTimeout = -1;
        });
    }

    private _changeColors(entities: StoredEntity<FilterRequest>[]): void {
        if (!this._filters || this._activeSearch) {
            return;
        }
        entities.forEach((entity: StoredEntity<FilterRequest>) => {
            this._filters !== undefined &&
                this._filters.data.datasets.forEach((dataset: any) => {
                    if (
                        dataset.label === entity.definition.uuid &&
                        dataset.backgroundColor !== entity.definition.colors.background
                    ) {
                        dataset.backgroundColor = entity.definition.colors.background;
                    }
                });
        });
        this._filters.update();
    }

    private _extractData(checkForData: boolean): void {
        this._datasets = [];
        const filters: StoredEntity<FilterRequest>[] = this._session.search
            .store()
            .filters()
            .get()
            .filter((f) => f.definition.active);
        filters.forEach((filter: StoredEntity<FilterRequest>) => {
            this._datasets.push({
                barPercentage: 1,
                categoryPercentage: 1,
                label: filter.definition.uuid,
                backgroundColor: filter.definition.colors.background,
                data: [],
            });
        });
        let noData: boolean = true;
        this._map.forEach((value: number[][], line: number) => {
            if (value.length > 0) {
                noData = false;
            }
            value.forEach((matches: number[]) => {
                if (matches[0] === undefined || matches[1] === undefined) {
                    return;
                }
                const index: number = matches[0];
                const filter: StoredEntity<FilterRequest> = filters[index];
                if (filter === undefined || index >= this._datasets.length) {
                    return;
                }
                this._datasets[index].data[line] = matches[1];
                this._datasets[index].backgroundColor = this._activeSearch
                    ? scheme_color_match
                    : filter.definition.colors.background;
            });
        });
        if (checkForData) {
            this._service.noData = noData;
        }
    }

    private _createChart(chartName: EChartName): void {
        this._filters = new Chart(`${chartName}-${this._session.uuid()}`, {
            type: 'bar',
            data: {
                labels: new Array(this._map.length).fill(''),
                datasets: this._datasets,
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
}
