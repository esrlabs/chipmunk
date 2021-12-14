export interface IDLTRecentTimeZoneResponse {
    timezone: string;
}

export class DLTRecentTimeZoneResponse {
    public static signature: string = 'DLTRecentTimeZoneResponse';
    public signature: string = DLTRecentTimeZoneResponse.signature;
    public timezone: string = '';

    constructor(params: IDLTRecentTimeZoneResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTRecentTimeZoneResponse message`);
        }
        if (typeof params.timezone !== 'string') {
            throw new Error(`timezone should be defined.`);
        }
        this.timezone = params.timezone;
    }
}
