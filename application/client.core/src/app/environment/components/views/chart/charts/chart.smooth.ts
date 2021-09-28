import {
    AChart,
    IRange,
    IChartDatasetAPI,
    IOption,
    EOptionType,
    IOptionsObj,
} from './chart.interface';
import { IPC } from '../../../../services/service.electron.ipc';
import * as ColorScheme from '../../../../theme/colors';

interface IChartOptions {
    borderWidth: number;
    lineTension: number;
    pointRadius: number;
}

export default class Chart extends AChart {
    public getDataset(
        filter: string,
        matches: IPC.IChartMatch[],
        api: IChartDatasetAPI,
        width: number,
        range: IRange,
        preview: boolean,
    ): { dataset: { [key: string]: any }; max: number; min: number } {
        const results = [];
        let max: number = -1;
        let min: number = Infinity;
        matches.forEach((point: IPC.IChartMatch) => {
            if (!(point.value instanceof Array) || point.value.length === 0) {
                return;
            }
            const value: number = parseFloat(point.value[0]);
            if (isNaN(value) || !isFinite(value)) {
                return;
            }
            if (max < value) {
                max = value;
            }
            if (min > value) {
                min = value;
            }
            if (point.row < range.begin) {
                return;
            }
            if (point.row > range.end) {
                // TODO: here we can jump out
                return;
            }
            results.push({
                x: point.row,
                y: value,
                row: point.row,
            });
        });
        // Find borders first
        const left: number | undefined = api.getLeftPoint(filter, range.begin);
        const right: number | undefined = api.getRightPoint(filter, range.end, false);
        if (results.length > 0) {
            left !== undefined &&
                results.unshift(...[{ x: range.begin, y: left, row: range.begin }]);
            right !== undefined && results.push(...[{ x: range.end, y: right, row: range.end }]);
        } else {
            left !== undefined && results.push(...[{ x: range.begin, y: left, row: range.begin }]);
            right !== undefined && results.push(...[{ x: range.end, y: right, row: range.end }]);
            if (results.length !== 2) {
                left !== undefined && results.push(...[{ x: range.end, y: left, row: range.end }]);
                right !== undefined &&
                    results.unshift(...[{ x: range.begin, y: right, row: range.begin }]);
            }
        }
        const color: string | undefined = api.getColor(filter);
        const options: IChartOptions = this._getDefaultOpt(api.getOptions(filter));
        const dataset = {
            yAxisID: `Y-${filter}`,
            label: filter,
            borderColor: color === undefined ? ColorScheme.scheme_search_match : color,
            data: results,
            borderWidth: options.borderWidth,
            pointRadius: preview ? 0 : options.pointRadius,
            pointHoverRadius: preview ? 0 : options.pointRadius,
            fill: false,
            tension: 0,
            showLine: true,
            lineTension: options.lineTension,
        };
        return { dataset: dataset, max: max, min: isFinite(min) ? min : 0 };
    }

    public getOptions(opt: any): IOption[] {
        const options: IChartOptions = this._getDefaultOpt(opt);
        return [
            {
                type: EOptionType.slider,
                option: { min: 0.1, max: 1, step: 0.1 },
                caption: 'Line Tension',
                value: options.lineTension,
                name: 'lineTension',
            },
            {
                type: EOptionType.slider,
                option: { min: 1, max: 5, step: 1 },
                caption: 'Border Width, px',
                value: options.borderWidth,
                name: 'borderWidth',
            },
            {
                type: EOptionType.slider,
                option: { min: 0, max: 5, step: 1 },
                caption: 'Point Radius, px',
                value: options.pointRadius,
                name: 'pointRadius',
            },
        ];
    }

    public getDefaultsOptions(opt?: IOptionsObj): IOptionsObj {
        const defaults: IChartOptions = this._getDefaultOpt(opt);
        const results: IOptionsObj = {};
        ['borderWidth', 'lineTension', 'pointRadius'].forEach((prop: string) => {
            results[prop] = (defaults as any)[prop];
        });
        return results;
    }

    public setOption(opt: IOptionsObj, option: IOption): IOptionsObj {
        const options: IOptionsObj = this._getDefaultOpt(opt) as any;
        options[option.name] = option.value;
        return options;
    }

    private _getDefaultOpt(opt: any): IChartOptions {
        if (typeof opt !== 'object' || opt === null) {
            opt = {};
        }
        if (
            typeof opt.borderWidth !== 'number' ||
            isNaN(opt.borderWidth) ||
            !isFinite(opt.borderWidth)
        ) {
            opt.borderWidth = 2;
        }
        if (
            typeof opt.lineTension !== 'number' ||
            isNaN(opt.lineTension) ||
            !isFinite(opt.lineTension)
        ) {
            opt.lineTension = 0.1;
        }
        if (
            typeof opt.pointRadius !== 'number' ||
            isNaN(opt.pointRadius) ||
            !isFinite(opt.pointRadius)
        ) {
            opt.pointRadius = 1;
        }
        return opt as IChartOptions;
    }
}
