import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entity } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'ListFilesAndFoldersRequest' })
export class Request extends SignatureRequirement {
    public paths: string[];
    public depth: number;
    public max: number;
    public include: { files: boolean; folders: boolean };

    constructor(input: {
        paths: string[];
        depth: number;
        max: number;
        include: { files: boolean; folders: boolean };
    }) {
        super();
        validator.isObject(input);
        this.paths = validator.getAsArrayOfNotEmptyString(input, 'paths');
        this.depth = validator.getAsValidNumber(input, 'depth');
        this.max = validator.getAsValidNumber(input, 'max');
        this.include = validator.getAsObj(input, 'include');
        this.include.files = validator.getAsBool(this.include, 'files');
        this.include.folders = validator.getAsBool(this.include, 'folders');
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
