import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'BackendJob' })
export class Event extends SignatureRequirement {
    public uuid: string;
    public progress: number;
    public session?: string;
    public name?: string;
    public desc?: string;
    public icon?: string;
    public spinner?: boolean;

    constructor(input: {
        uuid: string;
        progress: number;
        session?: string;
        name?: string;
        desc?: string;
        icon?: string;
        spinner?: boolean;
    }) {
        super();
        validator.isObject(input);
        this.progress = validator.getAsValidNumber(input, 'progress', { min: 0, max: 100 });
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
        this.session = validator.getAsNotEmptyStringOrAsUndefined(input, 'session');
        this.name = validator.getAsNotEmptyStringOrAsUndefined(input, 'name');
        this.desc = validator.getAsNotEmptyStringOrAsUndefined(input, 'desc');
        this.icon = validator.getAsStringOrAsUndefined(input, 'icon');
        this.spinner = typeof input.spinner === 'boolean' ? input.spinner : undefined;
    }
}

export interface Event extends Interface {}
