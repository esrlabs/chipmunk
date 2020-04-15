export interface IChipmunkLogsResponse {
    error?: string;
}

export class ChipmunkLogsResponse {
    public static signature: string = 'ChipmunkLogsResponse';
    public signature: string = ChipmunkLogsResponse.signature;
    public error?: string;

    constructor(params: IChipmunkLogsResponse) {
        this.error = params.error;
    }
}
