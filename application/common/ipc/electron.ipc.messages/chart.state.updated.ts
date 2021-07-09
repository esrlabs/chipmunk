import { TExtractedValues } from '../../interfaces/interface.rust.api.general';

export interface IChartStateUpdated {
    streamId: string;
    state: TExtractedValues;
}

export class ChartStateUpdated {
    public static signature: string = 'ChartStateUpdated';
    public signature: string = ChartStateUpdated.signature;
    public streamId: string;
    public state: TExtractedValues;


    constructor(params: IChartStateUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartStateUpdated message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.state !== 'object' || params.state === null) {
            throw new Error(`Field "results" should be TExtractedValues`);
        }
        this.streamId = params.streamId;
        this.state = params.state;
    }
}
