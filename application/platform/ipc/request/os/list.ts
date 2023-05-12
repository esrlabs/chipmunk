import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entity } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'ListFilesAndFoldersRequest' })
export class Request extends SignatureRequirement {
    public path: string;
    public deep: number;
    public max: number;

    constructor(input: { path: string; deep: number; max: number }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
        this.deep = validator.getAsValidNumber(input, 'deep');
        this.max = validator.getAsValidNumber(input, 'max');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ListFilesAndFoldersResponse' })
export class Response extends SignatureRequirement {
    public entities: Entity[];
    public max: boolean;

    constructor(input: { entities: Entity[]; max: boolean }) {
        super();
        validator.isObject(input);
        this.entities = validator.getAsArray(input, 'entities');
        this.max = validator.getAsBool(input, 'max');
    }
}

export interface Response extends Interface {}
