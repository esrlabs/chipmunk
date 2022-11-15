import { Define, Interface, SignatureRequirement } from '../declarations';
import { ParserName } from '../../../types/observe';
import * as validator from '../../../env/obj';

@Define({ name: 'CliStdoutRequest' })
export class Request extends SignatureRequirement {
    public commands: string[];
    public cwd: string;
    public parser: ParserName;

    constructor(input: { commands: string[]; cwd: string; parser: ParserName }) {
        super();
        validator.isObject(input);
        this.commands = validator.getAsArray(input, 'commands');
        this.cwd = validator.getAsNotEmptyString(input, 'cwd');
        this.parser = validator.getAsNotEmptyString(input, 'parser') as ParserName;
    }
}
export interface Request extends Interface {}

@Define({ name: 'CliStdoutResponse' })
export class Response extends SignatureRequirement {
    public sessions: string[] | undefined;
    public error: string | undefined;

    constructor(input: { sessions: string[] | undefined; error: string | undefined }) {
        super();
        validator.isObject(input);
        this.sessions = validator.getAsArrayOrUndefined(input, 'sessions');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
