export interface IMatch {
    row: number;
    value: string[] | undefined;
}

export type TResults = { [source: string]: IMatch[] };

export interface IChartRequestResults {
    streamId: string;
    requestId: string;
    results: TResults;
    error?: string;
    duration: number;
}

export class ChartRequestResults {
    public static signature: string = 'ChartRequestResults';
    public signature: string = ChartRequestResults.signature;
    public streamId: string;
    public requestId: string;
    public results: TResults;
    public duration: number;
    public error?: string;

    constructor(params: IChartRequestResults) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartRequestResults message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        if (typeof params.results !== 'object' || params.results === null) {
            throw new Error(`Field "results" should be { [regIndex: number]: number[] }`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined as string`);
        }
        if (typeof params.duration !== 'number' || isNaN(params.duration) || !isFinite(params.duration)) {
            throw new Error(`Field "duration" should be defined as valid number`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.results = params.results;
        this.error = params.error;
        this.duration = params.duration;
    }
}
