

import { IRange } from '../../interfaces/interface.timerange';

export interface ITimerangeSearchProgress {
    id: string;
    session: string;
    ranges: IRange[];
}

export class TimerangeSearchProgress {

    public static signature: string = 'TimerangeSearchProgress';
    public signature: string = TimerangeSearchProgress.signature;
    public id: string = '';
    public session: string = '';
    public ranges: IRange[] = [];

    constructor(params: ITimerangeSearchProgress) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimerangeSearchProgress message`);
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
    }
}
