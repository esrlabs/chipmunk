import {
    Component,
    ChangeDetectorRef,
    Input,
    OnDestroy,
    AfterContentInit,
    ViewChild,
} from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/serial';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Action } from '@ui/tabs/observe/action';
import { Session } from '@service/session';
import {
    AutocompleteInput,
    Options as AutocompleteOptions,
} from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';
import { PathErrorState } from './error';

import * as Stream from '@platform/types/observe/origin/stream/index';

@Component({
    selector: 'app-serial-setup-base',
    template: '',
    standalone: false,
})
@Ilc()
export class SetupBase extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public configuration!: Stream.Serial.Configuration;
    @Input() public action!: Action;
    @Input() public session: Session | undefined;
    @ViewChild('path') public pathInputRef!: AutocompleteInput;

    public state!: State;
    public pathInputOptions: AutocompleteOptions = {
        name: 'SerialPortPathRecentList',
        storage: 'serialport_paths_recent',
        defaults: '',
        placeholder: 'Enter path to serial port',
        label: 'Serial port path',
        recent: new Subject<string | undefined>(),
        error: new PathErrorState(),
    };

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

    public selectDetectedPort(port: string): void {
        this.state.configuration.configuration.path = port;
        this.pathInputRef.set(port).focus();
    }

    public onPathChange(value: string): void {
        this.state.configuration.configuration.path = value;
    }

    public onPathEnter(): void {
        if (this.pathInputRef.error.is() || this.state.configuration.validate() !== undefined) {
            return;
        }
        this.action.apply();
        this.markChangesForCheck();
    }

    public panel(): void {
        this.markChangesForCheck();
    }
}
export interface SetupBase extends IlcInterface {}
