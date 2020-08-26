export interface ITimestampFormatRecentAdd {
    format: string;
}

export class TimestampFormatRecentAdd {

    public static signature: string = 'TimestampFormatRecentAdd';
    public signature: string = TimestampFormatRecentAdd.signature;
    public format: string = '';

    constructor(params: ITimestampFormatRecentAdd) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimestampFormatRecentAdd message`);
        }
        if (typeof params.format !== 'string' || params.format.trim() === '') {
            throw new Error(`format should be defined as string.`);
        }
        this.format = params.format;
    }
}
