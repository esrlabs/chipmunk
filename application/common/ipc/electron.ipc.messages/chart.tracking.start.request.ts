export interface IChartTrackingStartRequest {
    session: string;
}

export class ChartTrackingStartRequest {
    public static signature: string = 'ChartTrackingStartRequest';
    public signature: string = ChartTrackingStartRequest.signature;
    public session: string;

    constructor(params: IChartTrackingStartRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartTrackingStartRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Field "session" should be defined`);
        }
        this.session = params.session;
    }
}
