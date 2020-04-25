export interface ITimestampFormat {
    Ok?: ITimestampFormatOk,
    Err?: string,
}
export interface ITimestampFormatOk {
    format: string;
    regex: string;
    flags: string[];
}
