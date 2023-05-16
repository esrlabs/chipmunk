import { Dlt } from './dlt';

export class PcapNG extends Dlt {
    constructor(inputs: { [key: string]: unknown }) {
        super(inputs);
    }

    public override asObj(): { [key: string]: unknown } {
        const base = Object.assign(super.asObj(), { pcapng: this.options });
        base['dlt'] = undefined;
        return base;
    }
}
