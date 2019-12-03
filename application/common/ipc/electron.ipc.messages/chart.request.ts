export interface IRegExpStr {
    source: string;
    flags: string;
    groups: boolean;
}

export interface IChartRequest {
    streamId: string;
    requestId: string;
    requests: IRegExpStr[];
}

export class ChartRequest {
    public static signature: string = 'ChartRequest';
    public signature: string = ChartRequest.signature;
    public streamId: string;
    public requestId: string;
    public requests: IRegExpStr[];

    constructor(params: IChartRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartRequest message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        if (!(params.requests instanceof Array)) {
            throw new Error(`Field "request" should be an instance of IRegExpStr[]`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.requests = params.requests;
    }
}
