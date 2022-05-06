

import { DateTimeReplacements } from '../../interfaces/interface.detect';
import { ISearchExpression, ISearchExpressionFlags } from './search.request';

export interface ITimerangeSearchRequest {
    id: string;
    session: string;
    format: string;
    points: ISearchExpression[];
    strict: boolean;
    replacements: DateTimeReplacements;
}

export class TimerangeSearchRequest {

    public static signature: string = 'TimerangeSearchRequest';
    public signature: string = TimerangeSearchRequest.signature;
    public id: string = '';
    public session: string = '';
    public format: string = '';
    public points: ISearchExpression[];
    public strict: boolean;
    public replacements: DateTimeReplacements;

    constructor(params: ITimerangeSearchRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TimerangeSearchRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.format !== 'string' || params.format.trim() === '') {
            throw new Error(`format should be defined.`);
        }
        if (typeof params.strict !== 'boolean') {
            throw new Error(`strict should be defined.`);
        }
        if (!(params.points instanceof Array) || params.points.length < 2) {
            throw new Error(`points should be defined as Array<ISearchExpression>. Shoud be defined at least 2 points.`);
        }
        if (typeof params.replacements === 'object' && params.replacements !== null) {
            this.replacements = params.replacements;
        } else {
            this.replacements = {};
        }
        this.id = params.id;
        this.session = params.session;
        this.format = params.format;
        this.points = params.points;
        this.strict = params.strict;
    }
}
