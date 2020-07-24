

import { DateTimeReplacements } from '../../interfaces/interface.detect';
import { ISearchExpression, ISearchExpressionFlags } from './search.request';

export interface ITimerangeSearchRequest {
    id: string;
    session: string;
    format: string;
    start: ISearchExpression;
    end: ISearchExpression;
    replacements: DateTimeReplacements;
}

export class TimerangeSearchRequest {

    public static signature: string = 'TimerangeSearchRequest';
    public signature: string = TimerangeSearchRequest.signature;
    public id: string = '';
    public session: string = '';
    public format: string = '';
    public start: ISearchExpression;
    public end: ISearchExpression;
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
        if (typeof params.start !== 'object' || params.start === null) {
            throw new Error(`start should be defined as ISearchExpression.`);
        }
        if (typeof params.end !== 'object' || params.end === null) {
            throw new Error(`end should be defined as ISearchExpression.`);
        }
        if (typeof params.replacements === 'object' && params.replacements !== null) {
            this.replacements = params.replacements;
        } else {
            this.replacements = {};
        }
        this.id = params.id;
        this.session = params.session;
        this.format = params.format;
        this.start = params.start;
        this.end = params.end;
    }
}
