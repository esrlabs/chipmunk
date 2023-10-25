import { Define, Interface, SignatureRequirement } from '../declarations';
import { IRange } from '../../../types/range';
import * as validator from '../../../env/obj';

@Define({ name: 'SessionExportRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public ranges: IRange[];
    public dest: string | undefined;

    constructor(input: { session: string; dest: string | undefined; ranges: IRange[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.dest = validator.getAsNotEmptyStringOrAsUndefined(input, 'dest');
        this.ranges = validator.getAsArray(input, 'ranges');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SessionExportResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public filename: string | undefined;

    constructor(input: { filename: string | undefined; error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.filename = validator.getAsNotEmptyStringOrAsUndefined(input, 'filename');
    }
}

export interface Response extends Interface {}
