export interface IChartRequestCancelRequest {
    streamId: string;
    requestId: string;
}

export class ChartRequestCancelRequest {
    public static signature: string = 'ChartRequestCancelRequest';
    public signature: string = ChartRequestCancelRequest.signature;
    public streamId: string;
    public requestId: string;

    constructor(params: IChartRequestCancelRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartRequestCancelRequest message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
    }
}
