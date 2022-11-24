import { Define, Interface, SignatureRequirement } from '../declarations';
import { IRange } from '../../../types/range';
import * as validator from '../../../env/obj';

@Define({ name: 'SessionExportRawRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public ranges: IRange[];
    public dest: string;

    constructor(input: { session: string; dest: string; ranges: IRange[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.dest = validator.getAsNotEmptyString(input, 'dest');
        this.ranges = validator.getAsArray(input, 'ranges');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SessionExportRawResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public complete: boolean;

    constructor(input: { complete: boolean; error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.complete = validator.getAsBool(input, 'complete');
    }
}

export interface Response extends Interface {}
