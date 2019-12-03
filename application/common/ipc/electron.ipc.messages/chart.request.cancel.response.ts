export interface IChartRequestCancelResponse {
    streamId: string;
    requestId: string;
    error?: string;
}

export class ChartRequestCancelResponse {
    public static signature: string = 'ChartRequestCancelResponse';
    public signature: string = ChartRequestCancelResponse.signature;
    public streamId: string;
    public requestId: string;
    public error?: string;

    constructor(params: IChartRequestCancelResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartRequestCancelResponse message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.error = params.error;
    }
}
