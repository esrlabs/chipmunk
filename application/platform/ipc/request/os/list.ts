import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entity } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'ListFilesAndFoldersRequest' })
export class Request extends SignatureRequirement {
    public paths: string[];
    public deep: number;
    public max: number;
    public includeFiles: boolean;
    public includeFolders: boolean;

    constructor(input: { paths: string[]; deep: number; max: number, includeFiles: boolean, includeFolders: boolean }) {
        super();
        validator.isObject(input);
        this.paths = validator.getAsArrayOfNotEmptyString(input, 'paths');
        this.deep = validator.getAsValidNumber(input, 'deep');
        this.max = validator.getAsValidNumber(input, 'max');
        this.includeFiles = validator.getAsBool(input, 'includeFiles');
        this.includeFolders = validator.getAsBool(input, 'includeFolders');
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
