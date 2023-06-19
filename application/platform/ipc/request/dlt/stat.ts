import { Define, Interface, SignatureRequirement } from '../declarations';
import { StatisticInfo } from '../../../types/observe/parser/dlt';
import * as validator from '../../../env/obj';

@Define({ name: 'DltStatRequest' })
export class Request extends SignatureRequirement {
    public files: string[];

    constructor(input: { files: string[] }) {
        super();
        validator.isObject(input);
        this.files = validator.getAsArray(input, 'files');
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
