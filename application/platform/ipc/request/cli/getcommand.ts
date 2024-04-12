import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'CliGetCommandRequest' })
export class Request extends SignatureRequirement {

}
export interface Request extends Interface {}

@Define({ name: 'CliGetCommandResponse' })
export class Response extends SignatureRequirement {
    public command: string;

    constructor(input: {  command: string }) {
        super();
        this.command = validator.getAsNotEmptyStringOrAsUndefined(input, 'command');
    }
}

export interface Response extends Interface {}
