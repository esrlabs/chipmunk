export interface IChartTrackingStopResponse {
    session: string;
    error?: string;
}

export class ChartTrackingStopResponse {
    public static signature: string = 'ChartTrackingStopResponse';
    public signature: string = ChartTrackingStopResponse.signature;
    public session: string;
    public error?: string;

    constructor(params: IChartTrackingStopResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartTrackingStopResponse message`);
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
