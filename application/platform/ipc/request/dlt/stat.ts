import { Define, Interface, SignatureRequirement } from '../declarations';
import { DltStatisticInfo } from '../../../types/bindings';
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
    public stat: DltStatisticInfo;

    constructor(input: { stat: DltStatisticInfo }) {
        super();
        validator.isObject(input);
        this.stat = validator.getAsObj(input, 'stat');
    }
}

export interface Response extends Interface {}
