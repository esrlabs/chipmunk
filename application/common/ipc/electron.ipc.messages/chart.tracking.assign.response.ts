export interface IChartTrackingAssignResponse {
    session: string;
    error?: string;
}

export class ChartTrackingAssignResponse {
    public static signature: string = 'ChartTrackingAssignResponse';
    public signature: string = ChartTrackingAssignResponse.signature;
    public session: string;
    public error?: string;

    constructor(params: IChartTrackingAssignResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartTrackingAssignResponse message`);
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
