import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    Input,
    ViewChild,
    OnDestroy,
} from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { FolderInput, Options as FoldersOptions } from '@elements/folderinput/component';
import {
    AutocompleteInput,
    Options as AutocompleteOptions,
} from '@elements/autocomplete/component';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { State } from '../../states/process';
import { components } from '@env/decorators/initial';
import { ShellProfile } from '@platform/types/shells';
import { Action } from '@ui/tabs/observe/action';
import { Session } from '@service/session';

import * as Stream from '@platform/types/observe/origin/stream/index';

@Component({
    selector: 'app-process-setup-base',
    template: '',
})
@Ilc()
export class SetupBase
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    @Input() public configuration!: Stream.Process.IConfiguration;
    @Input() public action!: Action;
    @Input() public session: Session | undefined;

    public state!: State;

    @ViewChild('cwd') public cwdInputRef!: FolderInput;
    @ViewChild('cmd') public cmdInputRef!: AutocompleteInput;

    private _inputs!: {
        cmd: AutocompleteOptions;
        cwd: FoldersOptions;
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public setInputs(inputs: { cmd: AutocompleteOptions; cwd: FoldersOptions }): void {
        this._inputs = inputs;
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.action, this.configuration);
        this._inputs.cmd.defaults = this.state.configuration.command;
        this._inputs.cwd.defaults = this.state.configuration.cwd;
        // this.action.subjects.get().applied.subscribe(() => {
        //     this._inputs.cmd.recent.emit(undefined);
        //     this.state.configuration.cwd.trim() !== '' &&
        //         this.ilc()
        //             .services.system.bridge.cwd()
        //             .set(undefined, this.state.configuration.cwd)
        //             .catch((err: Error) => {
        //                 this.log().error(`Fail to set cwd path: ${err.message}`);
        //             });
        // });
        // if (this.state.configuration.command.trim() === '') {
        //     this.action.setDisabled(true);
        // }
        this.ilc()
            .services.system.bridge.env()
            .get()
            .then((envs) => {
                this.state.configuration.envs = envs;
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get envvars path: ${err.message}`);
            })
            .finally(() => {
                this.detectChanges();
            });
        this.ilc()
            .services.system.bridge.os()
            .envvars()
            .then((envvars) => {
                this.state.envvars = envvars;
            })
            .catch((err: Error) => {
                this.log().warn(`Fail to get no context envvars: ${err.message}`);
            })
            .finally(() => {
                this.detectChanges();
            });
        this.ilc()
            .services.system.bridge.os()
            .shells()
            .then((profiles) => {
                this.state
                    .setProfiles(profiles)
                    .catch((err: Error) => {
                        this.log().error(`Fail to set profiles: ${err.message}`);
                    })
                    .finally(() => {
                        this.detectChanges();
                    });
            })
            .catch((err: Error) => {
                this.log().warn(`Fail to get a list of shell's profiles: ${err.message}`);
                this.state
                    .setProfiles([])
                    .catch((err: Error) => {
                        this.log().error(`Fail to set profiles: ${err.message}`);
                    })
                    .finally(() => {
                        this.detectChanges();
                    });
            })
            .finally(() => {
                this.detectChanges();
            });
    }

    public ngAfterViewInit(): void {
        this.cmdInputRef.set(this.state.configuration.command);
        this.cwdInputRef.set(this.state.configuration.cwd);
        if (this.state.configuration.cwd.trim() !== '') {
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
            })
            .finally(() => {
                this.detectChanges();
            });
    }

    public edit(target: 'cmd' | 'cwd', value: string): void {
        if (target === 'cmd') {
            this.state.configuration.command = value;
            // this.action.setDisabled(value.trim() === '');
        } else {
            this.state.configuration.cwd = value;
            // this.action.setDisabled(this.cwdInputRef.error.is());
        }
    }

    public enter(target: 'cmd' | 'cwd'): void {
        if (this.cwdInputRef.error.is() || this.cmdInputRef.error.is()) {
            return;
        }
        if (target === 'cmd') {
            // this.action.apply();
            this.cmdInputRef.control.drop();
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
        this.state.importEnvvarsFromShell(profile).catch((err: Error) => {
            this.log().error(`Fail to save selected profile: ${err.message}`);
        });
        this.detectChanges();
    }
}
export interface SetupBase extends IlcInterface {}
