import { IFilter } from '../../interfaces/interface.rust.api.general';

export interface IChartTrackingAssignRequest {
    session: string;
    filters: IFilter[];
}

export class ChartTrackingAssignRequest {
    public static signature: string = 'ChartTrackingAssignRequest';
    public signature: string = ChartTrackingAssignRequest.signature;
    public session: string;
    public filters: IFilter[];

    constructor(params: IChartTrackingAssignRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ChartTrackingAssignRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Field "session" should be defined`);
        }
        if (!(params.filters instanceof Array)) {
            throw new Error(`Field "filters" should be defined as an Array<IFilter>`);
        }
        this.session = params.session;
        this.filters = params.filters;
    }
}
