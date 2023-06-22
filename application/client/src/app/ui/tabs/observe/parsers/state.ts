import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Observe } from '@platform/types/observe';
import { Holder } from '@module/matcher';

export class State extends Holder {
    protected ref!: IlcInterface & ChangesDetector;

    constructor(public readonly observe: Observe) {
        super();
    }

    public bind(ref: IlcInterface & ChangesDetector) {
        this.ref = ref;
    }
}
