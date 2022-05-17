import { Dlt } from './dlt';

export class Pcap extends Dlt {
    constructor(inputs: { [key: string]: unknown }) {
        super(inputs);
    }

    public override asObj(): { [key: string]: unknown } {
        const base = Object.assign(super.asObj(), { pcap: this.options});
        base['dlt'] = undefined;
        return base;
    }
}
