export interface IChartTrackingStartResponse {
    session: string;
    error?: string;
}

export class ChartTrackingStartResponse {
    public static signature: string = 'ChartTrackingStartResponse';
    public signature: string = ChartTrackingStartResponse.signature;
    public session: string;
    public error?: string;

    constructor(params: IChartTrackingStartResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartTrackingStartResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Field "session" should be defined`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined as string`);
        }
        this.session = params.session;
        this.error = params.error;
    }
}
