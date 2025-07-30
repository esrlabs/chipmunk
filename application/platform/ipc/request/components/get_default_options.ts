import { Define, Interface, SignatureRequirement } from '../declarations';
import { FieldList, SessionAction } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'GetDefaultOptionsRequest' })
export class Request extends SignatureRequirement {
    public uuid: string;
    public origin: SessionAction;

    constructor(input: { uuid: string; origin: SessionAction }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
        this.origin = input.origin;
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetDefaultOptionsResponse' })
export class Response extends SignatureRequirement {
    public fields: FieldList;

    constructor(input: { fields: FieldList }) {
        super();
        validator.isObject(input);
        this.fields = validator.getAsArray(input, 'fields');
    }
}

export interface Response extends Interface {}
