import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'CLIOpenFiles' })
export class Event extends SignatureRequirement {
    public files: string[];

    constructor(input: { files: string[] }) {
        super();
        validator.isObject(input);
        this.files = validator.getAsArray(input, 'files');
    }
}

export interface Event extends Interface {}
