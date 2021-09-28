import { IPC } from '../../../../services/service.electron.ipc';

export enum EChartType {
    stepped = 'stepped',
    smooth = 'smooth',
}

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
    getOptions: (source: string) => IOptionsObj | undefined;
    getLeftPoint: (reg: string, begin: number) => number | undefined;
    getRightPoint: (reg: string, begin: number, previous: boolean) => number | undefined;
}

export enum EOptionType {
    input = 'input',
    list = 'list',
    slider = 'slider',
}

export interface IOptionInput {
    type: string;
    validate: (value: any) => boolean;
    value: number;
}

export interface IOptionList {
    items: Array<{ caption: string; value: any }>;
    value: string | number;
}

export interface IOptionSlider {
    min: number;
    max: number;
    step: number;
}

export interface IOption {
    caption: string;
    name: string;
    type: EOptionType;
    option: IOptionInput | IOptionList | IOptionSlider;
    value: any;
}

export interface IOptionsObj {
    [key: string]: string | number | boolean;
}

export abstract class AChart {
    abstract getDataset(
        filter: string,
        matches: IPC.IChartMatch[],
        api: IChartDatasetAPI,
        width: number,
        range: IRange,
        preview: boolean,
    ): { dataset: { [key: string]: any }; max: number; min: number };

    abstract getOptions(opt: IOptionsObj): IOption[];

    abstract getDefaultsOptions(opt?: IOptionsObj): IOptionsObj;

    abstract setOption(opt: IOptionsObj, option: IOption): IOptionsObj;
}
