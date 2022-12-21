import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'FoldersDelimiterRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'FoldersDelimiterResponse' })
export class Response extends SignatureRequirement {
    public delimiter: string;

    constructor(input: { delimiter: string }) {
        super();
        validator.isObject(input);
        this.delimiter = validator.getAsNotEmptyString(input, 'delimiter');
    }
}

export interface Response extends Interface {}
