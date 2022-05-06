import { Define, Interface, SignatureRequirement } from '../declarations';
import { StatisticInfo } from '../../../types/dlt';
import * as validator from '../../../env/obj';

@Define({ name: 'DltStatRequest' })
export class Request extends SignatureRequirement {
    public filename: string;

    constructor(input: { filename: string }) {
        super();
        validator.isObject(input);
        this.filename = validator.getAsNotEmptyString(input, 'filename');
    }
}
export interface Request extends Interface {}

@Define({ name: 'DltStatResponse' })
export class Response extends SignatureRequirement {
    public stat: StatisticInfo;

    constructor(input: { stat: StatisticInfo }) {
        super();
        validator.isObject(input);
        this.stat = validator.getAsObj(input, 'stat');
    }
}

export interface Response extends Interface {}
