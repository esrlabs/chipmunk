import { Define, Interface, SignatureRequirement } from '../declarations';
import { FieldDesc, SourceOrigin } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'GetComponentsOptionsRequest' })
export class Request extends SignatureRequirement {
    public targets: string[];
    public origin: SourceOrigin;

    constructor(input: { origin: SourceOrigin; targets: string[] }) {
        super();
        validator.isObject(input);
        this.targets = validator.getAsArray(input, 'targets');
        this.origin = validator.getAsObj(input, 'origin');
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetComponentsOptionsResponse' })
export class Response extends SignatureRequirement {
    public options: Map<string, FieldDesc[]>;

    constructor(input: { options: Map<string, FieldDesc[]> }) {
        super();
        validator.isObject(input);
        this.options = validator.getAsMap(input, 'options');
    }
}

export interface Response extends Interface {}
