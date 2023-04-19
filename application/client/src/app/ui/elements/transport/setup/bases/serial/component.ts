import { Component, ChangeDetectorRef, Input, OnDestroy } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/serial';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-serial-setup-base',
    template: '',
})
@Ilc()
export class SetupBase extends ChangesDetector implements OnDestroy {
    @Input() state!: State;
    @Input() action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy() {
        this.state.destroy();
    }
}
export interface SetupBase extends IlcInterface {}
