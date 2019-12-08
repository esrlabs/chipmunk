import { AChart, IRange, IChartDatasetAPI, IOption, EOptionType, IOptionsObj } from './chart.interface';
import { IPCMessages } from '../../../../services/service.electron.ipc';
import * as ColorScheme from '../../../../theme/colors';

interface IChartOptions {
    borderWidth: number;
    lineTension: number;
    pointRadius: number;
}

export default class Chart extends AChart {

    public getDataset(
        filter: string,
        matches: IPCMessages.IChartMatch[],
        api: IChartDatasetAPI,
        width: number,
        range: IRange,
        preview: boolean,
    ): { dataset: { [key: string]: any }, max: number, min: number } {
        const results = [];
        let max: number = -1;
        let min: number = Infinity;
        matches.forEach((point: IPCMessages.IChartMatch) => {
            if (!(point.value instanceof Array) || point.value.length === 0) {
                return;
            }
            const value: number = parseInt(point.value[0], 10);
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
                y: value
            });
        });
        // Find borders first
        const left: number | undefined = api.getLeftPoint(filter, range.begin);
        const right: number | undefined = api.getRightPoint(filter, range.end, false);
        if (results.length > 0) {
            left !== undefined && results.unshift(...[
                { x: range.begin, y: left },
            ]);
            right !== undefined && results.push(...[
                { x: range.end, y: right }
            ]);
        } else {
            left !== undefined && results.push(...[
                { x: range.begin, y: left }
            ]);
            right !== undefined && results.push(...[
                { x: range.end, y: right }
            ]);
            if (results.length !== 2) {
                left !== undefined && results.push(...[
                    { x: range.end, y: left }
                ]);
                right !== undefined && results.unshift(...[
                    { x: range.begin, y: right }
                ]);
            }
        }
        const color: string | undefined = api.getColor(filter);
        const options: IChartOptions = this._getDefaultOpt(api.getOptions(filter));
        const dataset = {
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
        return { dataset: dataset, max: max, min: isFinite(min) ? min : undefined };
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
                name: 'borderWidth'
            },
            {
                type: EOptionType.slider,
                option: { min: 0, max: 5, step: 1 },
                caption: 'Point Radius, px',
                value: options.pointRadius,
                name: 'pointRadius'
            }
        ];
    }

    public getDefaultsOptions(opt?: IOptionsObj): IOptionsObj {
        const defaults: IChartOptions = this._getDefaultOpt(opt);
        const results: IOptionsObj = {};
        ['borderWidth', 'lineTension', 'pointRadius'].forEach((prop: string) => {
            results[prop] = defaults[prop];
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
        if (typeof opt.borderWidth !== 'number' || isNaN(opt.borderWidth) || !isFinite(opt.borderWidth)) {
            opt.borderWidth = 1;
        }
        if (typeof opt.lineTension !== 'number' || isNaN(opt.lineTension) || !isFinite(opt.lineTension)) {
            opt.lineTension = 0.4;
        }
        if (typeof opt.pointRadius !== 'number' || isNaN(opt.pointRadius) || !isFinite(opt.pointRadius)) {
            opt.pointRadius = 2;
        }
        return opt as IChartOptions;
    }

}
