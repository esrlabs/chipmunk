import { TResults, IMatch } from './chart.request.results';

export interface IChartResultsUpdated {
    streamId: string;
    results: TResults;
}

export class ChartResultsUpdated {
    public static signature: string = 'ChartResultsUpdated';
    public signature: string = ChartResultsUpdated.signature;
    public streamId: string;
    public results: TResults;


    constructor(params: IChartResultsUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartResultsUpdated message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.results !== 'object' || params.results === null) {
            throw new Error(`Field "results" should be { [regIndex: number]: number[] }`);
        }
        this.streamId = params.streamId;
        this.results = params.results;
    }
}
