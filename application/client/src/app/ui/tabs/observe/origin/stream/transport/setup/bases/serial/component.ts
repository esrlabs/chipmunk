import { Component, ChangeDetectorRef, Input, OnDestroy, AfterContentInit } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/serial';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Action } from '@ui/tabs/observe/action';
import { Session } from '@service/session';

import * as Stream from '@platform/types/observe/origin/stream/index';

@Component({
    selector: 'app-serial-setup-base',
    template: '',
})
@Ilc()
export class SetupBase extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public configuration!: Stream.Serial.Configuration;
    @Input() public action!: Action;
    @Input() public session: Session | undefined;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.action, this.configuration);
        this.env().subscriber.register(
            this.state.changed.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.configuration.subscribe(() => {
                this.action.setDisabled(this.configuration.validate() instanceof Error);
                this.detectChanges();
            }),
            this.action.subjects.get().applied.subscribe(() => {
                this.action.setDisabled(this.configuration.validate() instanceof Error);
                this.detectChanges();
            }),
        );
        this.action.setDisabled(this.configuration.validate() instanceof Error);
        this.state.scan().start();
    }

    public ngOnDestroy() {
        this.state.scan().stop();
        this.state.destroy();
    }
}
export interface SetupBase extends IlcInterface {}
