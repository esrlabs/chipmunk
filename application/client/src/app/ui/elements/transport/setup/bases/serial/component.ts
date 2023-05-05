import { Component, ChangeDetectorRef, Input, OnDestroy, AfterContentInit } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/serial';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-serial-setup-base',
    template: '',
})
@Ilc()
export class SetupBase extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public state!: State;
    @Input() public action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.state.changed.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.state.scan().start();
    }

    public ngOnDestroy() {
        this.state.scan().stop();
        this.state.destroy();
    }
}
export interface SetupBase extends IlcInterface {}
