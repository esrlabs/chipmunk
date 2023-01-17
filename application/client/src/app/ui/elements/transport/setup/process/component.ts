import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';
import { Options as FoldersOptions, FolderInput } from '@elements/folderinput/component';
import { Subject } from '@platform/env/subscription';
import { CmdErrorState } from './error';

@Component({
    selector: 'app-transport-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportProcess
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    @Input() public state!: State;
    @Input() public action!: Action;
    @ViewChild('cwd') public cwdInputRef!: FolderInput;

    public readonly inputs: {
        cmd: AutocompleteOptions;
        cwd: FoldersOptions;
    } = {
        cmd: {
            name: 'CommandsRecentList',
            storage: 'processes_cmd_recent',
            defaults: '',
            placeholder: 'Enter terminal command',
            label: 'Terminal command',
            recent: new Subject<void>(),
            error: new CmdErrorState(),
        },
        cwd: {
            placeholder: 'Enter working folder',
            label: 'Terminal command',
            defaults: '',
        },
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.inputs.cmd.defaults = this.state.command;
        this.inputs.cwd.defaults = this.state.cwd;
        this.action.subjects.get().applied.subscribe(() => {
            this.inputs.cmd.recent.emit();
            this.state.cwd.trim() !== '' &&
                this.ilc()
                    .services.system.bridge.cwd()
                    .set(undefined, this.state.cwd)
                    .catch((err: Error) => {
                        this.log().error(`Fail to set cwd path: ${err.message}`);
                    });
        });
        if (this.state.command.trim() === '') {
            this.action.setDisabled(true);
        }
        this.ilc()
            .services.system.bridge.env()
            .get()
            .then((env) => {
                this.state.env = env;
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get envvars path: ${err.message}`);
            })
            .finally(() => {
                this.markChangesForCheck();
            });
    }

    public ngAfterViewInit(): void {
        if (this.state.cwd.trim() !== '') {
            return;
        }
        this.ilc()
            .services.system.bridge.cwd()
            .get(undefined)
            .then((cwd) => {
                this.cwdInputRef.set(cwd);
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get cwd path: ${err.message}`);
            });
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
        if (target === 'cmd' && !this.inputs.cmd.error?.is()) {
            this.action.apply();
        }
        this.markChangesForCheck();
    }

    public ngPanel(): void {
        this.markChangesForCheck();
    }
}
export interface TransportProcess extends IlcInterface {}
