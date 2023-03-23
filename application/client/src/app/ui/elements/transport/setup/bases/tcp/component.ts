import { Component, ChangeDetectorRef, Input, OnDestroy, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/tcp';
import { Action } from '@ui/tabs/sources/common/actions/action';

@Component({
    selector: 'app-tcp-setup-base',
    template: '',
})
@Ilc()
export class SetupBase extends ChangesDetector implements OnDestroy, AfterContentInit {
    @Input() public state!: State;
    @Input() public action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.state.subjects.get().updated.subscribe(this.verify.bind(this)),
        );
        this.env().subscriber.register(
            this.action.subjects.get().applied.subscribe(() => {
                this.state.drop();
                this.verify();
                this.detectChanges();
            }),
        );
        this.verify();
    }

    public verify() {
        this.action.setDisabled(!this.state.isValid());
    }
}
export interface SetupBase extends IlcInterface {}
