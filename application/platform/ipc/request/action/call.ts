import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'ActionCallRequest' })
export class Request extends SignatureRequirement {
    public uuid: string;
    public inputs: unknown | undefined;

    constructor(input: { uuid: string; inputs: unknown | undefined }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
        this.inputs = input.inputs;
    }
}
export interface Request extends Interface {}

@Define({ name: 'ActionCallResponse' })
export class Response extends SignatureRequirement {
    public uuid: string;
    public output: unknown | undefined;
    public error: string | undefined;

    constructor(input: { uuid: string; output: unknown | undefined; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.output = input.output;
    }
}

export interface Response extends Interface {}
