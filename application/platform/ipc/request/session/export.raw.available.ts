import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'IsExportRawAvaialbleRequest' })
export class Request extends SignatureRequirement {
    public session: string;

    constructor(input: { session: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
    }
}
export interface Request extends Interface {}

@Define({ name: 'IsExportRawAvaialbleResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public available: boolean;

    constructor(input: { available: boolean; error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.available = validator.getAsBool(input, 'available');
    }
}

export interface Response extends Interface {}
