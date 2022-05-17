import { Base } from './base';
import { IDLTOptions } from '@platform/types/parsers/dlt';

import * as obj from '@platform/env/obj';

export class Dlt extends Base {
    public options: IDLTOptions;

    constructor(inputs: { [key: string]: unknown }) {
        super(inputs);
        this.options = obj.getAsObj(inputs, 'dlt');
    }

    public override asObj(): { [key: string]: unknown } {
        const base = super.asObj();
        return Object.assign(base, { dlt: this.options});
    }
}
