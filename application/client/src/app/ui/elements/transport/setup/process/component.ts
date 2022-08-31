import { Component, ChangeDetectorRef, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';
import { CwdErrorState } from './error';

@Component({
    selector: 'app-transport-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportProcess extends ChangesDetector implements AfterViewInit, OnDestroy {
    @Input() public state!: State;
    @Input() public action!: Action;

    public readonly inputs: {
        cmd: AutocompleteOptions;
        cwd: AutocompleteOptions;
    } = {
        cmd: {
            name: 'CommandsRecentList',
            storage: 'processes_cmd_recent',
            defaults: '',
            placeholder: 'Enter terminal command',
            label: 'Terminal command',
            recent: new Subject<void>(),
        },
        cwd: {
            name: 'CwdRecentList',
            storage: 'processes_cwd_recent',
            defaults: '',
            placeholder: 'Enter terminal command',
            label: 'Terminal command',
            recent: new Subject<void>(),
            error: new CwdErrorState(),
        },
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterViewInit(): void {
        this.inputs.cmd.defaults = this.state.command;
        this.inputs.cwd.defaults = this.state.cwd;
        this.action.subjects.get().applied.subscribe(() => {
            this.inputs.cmd.recent.emit();
            this.inputs.cwd.recent.emit();
        });
        if (this.state.command.trim() === '') {
            this.action.setDisabled(true);
        }
    }

    public ngEdit(target: 'cmd' | 'cwd', value: string): void {
        if (target === 'cmd') {
            this.state.command = value;
            this.action.setDisabled(value.trim() === '');
        } else {
            this.state.cwd = value;
        }
    }

    public ngEnter(target: 'cmd' | 'cwd'): void {
        if (target === 'cmd') {
            this.action.apply();
        }
        this.markChangesForCheck();
    }

    public ngPanel(): void {
        this.markChangesForCheck();
    }
}
export interface TransportProcess extends IlcInterface {}
