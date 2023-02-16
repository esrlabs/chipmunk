import { Define, Interface, SignatureRequirement } from '../declarations';
import { FtOptions } from '../../../types/parsers/dlt';
import * as validator from '../../../env/obj';

@Define({ name: 'DltExtractAllRequest' })
export class Request extends SignatureRequirement {
    public file: string;
    public output: string;
    public options: FtOptions;

    constructor(input: { 
        file: string, 
        output: string, 
        options: FtOptions
    }) {
        super();
        validator.isObject(input);
        this.file = validator.getAsNotEmptyString(input, 'file');
        this.output = validator.getAsNotEmptyString(input, 'output');
        this.options = validator.getAsObj(input, 'options');
    }
}
export interface Request extends Interface {}

@Define({ name: 'DltExtractAllResponse' })
export class Response extends SignatureRequirement {
    public size: number;

    constructor(input: { size: number }) {
        super();
        validator.isObject(input);
        this.size = validator.getAsValidNumber(input, 'size');
    }
}

export interface Response extends Interface {}
