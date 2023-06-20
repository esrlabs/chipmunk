import { Define, Interface, SignatureRequirement } from '../declarations';
import { SomeipStatistic } from '../../../types/observe/parser/someip';

import * as validator from '../../../env/obj';

@Define({ name: 'SomeipStatisticRequest' })
export class Request extends SignatureRequirement {
    public files: string[];

    constructor(input: { files: string[] }) {
        super();
        validator.isObject(input);
        this.files = validator.getAsArray(input, 'files');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SomeipStatisticResponse' })
export class Response extends SignatureRequirement {
    public statistic: SomeipStatistic;

    constructor(input: { statistic: SomeipStatistic }) {
        super();
        validator.isObject(input);
        this.statistic = validator.getAsObj(input, 'statistic');
    }
}

export interface Response extends Interface {}
