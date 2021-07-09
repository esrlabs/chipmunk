export interface IChartTrackingStopRequest {
    session: string;
}

export class ChartTrackingStopRequest {
    public static signature: string = 'ChartTrackingStopRequest';
    public signature: string = ChartTrackingStopRequest.signature;
    public session: string;

    constructor(params: IChartTrackingStopRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartTrackingStopRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Field "session" should be defined`);
        }
        this.session = params.session;
    }
}
