export interface ITimestampFormat {
    Ok?: ITimestampFormatOk,
    Err?: string,
}
export interface ITimestampFormatOk {
    format: string;
    regex: string;
    flags: string[];
}
export interface ICheckFormatFlags {
    miss_day: boolean,
    miss_month: boolean,
    miss_year: boolean,
}
export interface DateTimeReplacements {
    day?: number;
    month?: number;
    year?: number;
    offset?: number;
}
