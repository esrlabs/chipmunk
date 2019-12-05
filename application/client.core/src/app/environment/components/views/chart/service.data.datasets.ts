
import { IStreamState } from '../../../controller/controller.session.tab';
import * as ColorScheme from '../../../theme/colors';
import { IPCMessages } from '../../../services/service.electron.ipc';

export interface IRange {
    begin: number;
    end: number;
}

export interface IResults {
    dataset: Array<{ [key: string]: any }>;
    max: number | undefined;
}

export interface IChartDatasetAPI {
    getColor: (source: string) => string | undefined;
    getLeftPoint: (reg: string, begin: number) => number | undefined;
    getRightPoint: (reg: string, begin: number, previous: boolean) => number | undefined;
}

export type TDatasetGetter = (  filter: string,
                                matches: IPCMessages.IChartMatch[],
                                api: IChartDatasetAPI,
                                width: number,
                                range: IRange,
                                preview: boolean) => { dataset: { [key: string]: any }, max: number };

export function stepped(
    filter: string,
    matches: IPCMessages.IChartMatch[],
    api: IChartDatasetAPI,
    width: number,
    range: IRange,
    preview: boolean = false
): { dataset: { [key: string]: any }, max: number } {
    const results = [];
    let max: number = -1;
    let prev: number | undefined;
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
        if (point.row < range.begin) {
            return;
        }
        if (point.row > range.end) {
            // TODO: here we can jump out
            return;
        }
        if (prev !== undefined) {
            results.push({
                x: point.row,
                y: prev
            });
        }
        results.push({
            x: point.row,
            y: value
        });
        prev = value;
    });
    // Find borders first
    const left: number | undefined = api.getLeftPoint(filter, range.begin);
    const right: number | undefined = api.getRightPoint(filter, range.end, true);
    if (results.length > 0) {
        left !== undefined && results.unshift(...[
            { x: range.begin,   y: left },
            { x: results[0].x,  y: left },
        ]);
        right !== undefined && results.push(...[
            { x: results[results.length - 1].x, y: right },
            { x: range.end,                     y: right }
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
    const dataset = {
        label: filter,
        borderColor: color === undefined ? ColorScheme.scheme_search_match : color,
        data: results,
        borderWidth: 1,
        pointRadius: preview ? 1 : 2,
        pointHoverRadius: preview ? 1 : 2,
        fill: false,
        tension: 0,
        showLine: true,
    };
    return { dataset: dataset, max: max };
}

export function smooth(
    filter: string,
    matches: IPCMessages.IChartMatch[],
    api: IChartDatasetAPI,
    width: number,
    range?: IRange,
    preview: boolean = false
): { dataset: { [key: string]: any }, max: number } {
    const results = [];
    let max: number = -1;
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
    const dataset = {
        label: filter,
        borderColor: color === undefined ? ColorScheme.scheme_search_match : color,
        data: results,
        borderWidth: 1,
        pointRadius: preview ? 1 : 2,
        pointHoverRadius: preview ? 1 : 2,
        fill: false,
        tension: 0,
        showLine: true,
        lineTension: 0.4
    };
    return { dataset: dataset, max: max };
}
/*
export function stepped2(
    api: IChartDatasetAPI,
    width: number,
    range?: IRange,
    preview: boolean = false
): IResults {
    const results: any = {};
    let max: number = -1;
    if (range === undefined) {
        range = {
            begin: 0,
            end: api.stream.count,
        };
    }
    Object.keys(api.charts).forEach((reg: string) => {
        const matches: IPCMessages.IChartMatch[] = api.charts[reg];
        let prev: number | undefined;
        if (results[reg] === undefined) {
            results[reg] = [];
        }
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
            if (point.row < range.begin) {
                return;
            }
            if (point.row > range.end) {
                // TODO: here we can jump out
                return;
            }
            if (prev !== undefined) {
                results[reg].push({
                    x: point.row,
                    y: prev
                });
            }
            results[reg].push({
                x: point.row,
                y: value
            });
            prev = value;
        });
        // Find borders first
        const left: number | undefined = api.getLeftPoint(reg, range.begin);
        const right: number | undefined = api.getRightPoint(reg, range.end);
        if (results[reg].length > 0) {
            left !== undefined && results[reg].unshift(...[
                { x: range.begin,       y: left },
                { x: results[reg][0].x, y: left },
            ]);
            right !== undefined && results[reg].push(...[
                { x: results[reg][results[reg].length - 1].x, y: right },
                { x: range.end,                               y: right }
            ]);
        } else {
            left !== undefined && results[reg].push(...[
                { x: range.begin, y: left }
            ]);
            right !== undefined && results[reg].push(...[
                { x: range.end, y: right }
            ]);
            if (results[reg].length !== 2) {
                left !== undefined && results[reg].push(...[
                    { x: range.end, y: left }
                ]);
                right !== undefined && results[reg].unshift(...[
                    { x: range.begin, y: right }
                ]);
            }
        }
    });
    const datasets = [];
    Object.keys(results).forEach((filter: string) => {
        const color: string | undefined = api.getColor(filter);
        const dataset = {
            label: filter,
            borderColor: color === undefined ? ColorScheme.scheme_search_match : color,
            data: results[filter],
            borderWidth: 1,
            pointRadius: preview ? 1 : 2,
            pointHoverRadius: preview ? 1 : 2,
            fill: false,
            tension: 0,
            showLine: true,
        };
        datasets.push(dataset);
    });
    return { dataset: datasets, max: max };
}

export function smooth(
    api: IChartDatasetAPI,
    width: number,
    range?: IRange,
    preview: boolean = false
): IResults {
    const results: any = {};
    let max: number = -1;
    if (range === undefined) {
        range = {
            begin: 0,
            end: api.stream.count,
        };
    }
    Object.keys(api.charts).forEach((reg: string) => {
        const matches: IPCMessages.IChartMatch[] = api.charts[reg];
        let prev: number | undefined;
        if (results[reg] === undefined) {
            results[reg] = [];
        }
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
            if (point.row < range.begin) {
                return;
            }
            if (point.row > range.end) {
                // TODO: here we can jump out
                return;
            }
            results[reg].push({
                x: point.row,
                y: value
            });
            prev = value;
        });
        // Find borders first
        const left: number | undefined = api.getLeftPoint(reg, range.begin);
        const right: number | undefined = api.getRightPoint(reg, range.end);
        if (results[reg].length > 0) {
            left !== undefined && results[reg].unshift(...[
                { x: range.begin, y: left },
            ]);
            right !== undefined && results[reg].push(...[
                { x: range.end, y: right }
            ]);
        } else {
            left !== undefined && results[reg].push(...[
                { x: range.begin, y: left }
            ]);
            right !== undefined && results[reg].push(...[
                { x: range.end, y: right }
            ]);
            if (results[reg].length !== 2) {
                left !== undefined && results[reg].push(...[
                    { x: range.end, y: left }
                ]);
                right !== undefined && results[reg].unshift(...[
                    { x: range.begin, y: right }
                ]);
            }
        }
    });
    const datasets = [];
    Object.keys(results).forEach((filter: string) => {
        const color: string | undefined = api.getColor(filter);
        const dataset = {
            label: filter,
            borderColor: color === undefined ? ColorScheme.scheme_search_match : color,
            data: results[filter],
            borderWidth: 1,
            pointRadius: preview ? 1 : 2,
            pointHoverRadius: preview ? 1 : 2,
            fill: false,
            tension: 0,
            showLine: true,
            lineTension: 0.4
        };
        datasets.push(dataset);
    });
    return { dataset: datasets, max: max };
}
*/
