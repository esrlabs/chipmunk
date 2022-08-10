import { Define, Interface, SignatureRequirement } from '../declarations';
import * as validator from '../../../env/obj';

@Define({ name: 'SerialPortsRequest' })
export class Request extends SignatureRequirement {
    constructor() {
        super();
    }
}
export interface Request extends Interface {}

@Define({ name: 'SerialPortsResponse' })
export class Response extends SignatureRequirement {
    public ports: string[];

    constructor(input: { ports: string[] }) {
        super();
        validator.isObject(input);
        this.ports = validator.getAsArray(input, 'ports');
    }
}

export interface Response extends Interface {}
