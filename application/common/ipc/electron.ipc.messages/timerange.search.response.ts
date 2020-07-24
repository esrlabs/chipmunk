

import { IRange } from '../../interfaces/interface.timerange';

export interface ITimerangeSearchResponse {
    id: string;
    session: string;
    ranges: IRange[];
    error?: string;
}

export class TimerangeSearchResponse {

    public static signature: string = 'TimerangeSearchResponse';
    public signature: string = TimerangeSearchResponse.signature;
    public id: string = '';
    public session: string = '';
    public ranges: IRange[] = [];
    public error?: string;

    constructor(params: ITimerangeSearchResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimerangeSearchResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (!(params.ranges instanceof Array)) {
            throw new Error(`ranges should be defined as Array<IRange>.`);
        }
        this.id = params.id;
        this.session = params.session;
        this.ranges = params.ranges;
        this.error = params.error;
    }
}
