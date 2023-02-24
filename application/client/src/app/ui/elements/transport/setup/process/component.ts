import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
    OnDestroy,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';
import { Options as FoldersOptions, FolderInput } from '@elements/folderinput/component';
import { AutocompleteInput } from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';
import { CmdErrorState } from './error';
import { components } from '@env/decorators/initial';
import { ShellProfile } from '@platform/types/shells';

@Component({
    selector: 'app-transport-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class TransportProcess
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    @Input() public state!: State;
    @Input() public action!: Action;
    @Input() public update?: Subject<void>;
    @ViewChild('cwd') public cwdInputRef!: FolderInput;
    @ViewChild('cmd') public cmdInputRef!: AutocompleteInput;

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
            label: 'Working folder',
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
        this.update !== undefined &&
            this.env().subscriber.register(
                this.update.subscribe(() => {
                    this.cmdInputRef.set(this.state.command);
                    this.cwdInputRef.set(this.state.cwd);
                }),
            );
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
        this.ilc()
            .services.system.bridge.os()
            .envvars()
            .then((envvars) => {
                this.state.envvars = envvars;
            })
            .catch((err: Error) => {
                this.log().warn(`Fail to get no context envvars: ${err.message}`);
            });
        this.ilc()
            .services.system.bridge.os()
            .shells()
            .then((profiles) => {
                this.state.profiles = profiles;
            })
            .catch((err: Error) => {
                this.log().warn(`Fail to get a list of shell's profiles: ${err.message}`);
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

    public edit(target: 'cmd' | 'cwd', value: string): void {
        if (target === 'cmd') {
            this.state.command = value;
            this.action.setDisabled(value.trim() === '');
        } else {
            this.state.cwd = value;
            this.action.setDisabled(this.cwdInputRef.error.is());
        }
    }

    public enter(target: 'cmd' | 'cwd'): void {
        if (this.cwdInputRef.error.is() || this.cmdInputRef.error.is()) {
            return;
        }
        if (target === 'cmd') {
            this.action.apply();
        }
        this.markChangesForCheck();
    }

    public panel(): void {
        this.markChangesForCheck();
    }

    public showEnvVars() {
        this.ilc().services.ui.popup.open({
            component: {
                factory: components.get('app-elements-pairs'),
                inputs: {
                    map: this.state.getSelectedEnvs(),
                },
            },
            closeOnKey: 'Escape',
            uuid: 'app-elements-pairs',
        });
    }

    public importEnvVars(profile: ShellProfile | undefined) {
        this.state.importEnvvarsFromShell(profile);
        this.detectChanges();
    }
}
export interface TransportProcess extends IlcInterface {}
