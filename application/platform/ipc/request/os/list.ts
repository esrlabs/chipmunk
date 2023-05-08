import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entity } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'ListFilesAndFoldersRequest' })
export class Request extends SignatureRequirement {
    public path: string;
    public deep: number;

    constructor(input: { path: string; deep: number }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
        this.deep = validator.getAsValidNumber(input, 'deep');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ListFilesAndFoldersResponse' })
export class Response extends SignatureRequirement {
    public entities: Entity[];

    constructor(input: { entities: Entity[] }) {
        super();
        validator.isObject(input);
        this.entities = validator.getAsArray(input, 'entities');
    }
}

export interface Response extends Interface {}
