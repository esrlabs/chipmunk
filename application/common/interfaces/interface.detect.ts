export interface ITimestampFormat {
    Ok?: ITimestampFormatOk,
    Err?: string,
}
export interface ITimestampFormatOk {
    formatstring: string;
    regex: string;
    flags: [string];
}
