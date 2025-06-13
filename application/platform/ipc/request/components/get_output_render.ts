import { Define, Interface, SignatureRequirement } from '../declarations';
import { FieldDesc, OutputRender, SessionAction } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'GetOutputRenderRequest' })
export class Request extends SignatureRequirement {
    public uuid: string;

    constructor(input: { uuid: string }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetOutputRenderResponse' })
export class Response extends SignatureRequirement {
    public render: OutputRender | null | undefined;

    constructor(input: { render: OutputRender | null | undefined }) {
        super();
        this.render = input.render;
    }
}

export interface Response extends Interface {}
