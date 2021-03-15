import { AfterContentInit, Component, ViewChild, ElementRef, Input, OnInit, OnDestroy } from '@angular/core';
import { sortPairs, IPair, ISortedFile } from '../../../../thirdparty/code/engine';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { Subscription, Observable } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ShellService, IInformation } from '../services/service';
import { SidebarAppShellEnvironmentComponent } from '../environment/component';
import { SidebarAppShellInputPwdComponent } from '../pwd/component';
import { Session } from '../../../../controller/session/session';

import EventsSessionService from '../../../../services/standalone/service.events.session';
import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import PopupsService from '../../../../services/standalone/service.popups';
import TabsSessionsService from '../../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IEditing {
    variable: boolean;
    path: boolean;
}

export interface IEnvironment {
    variable: string;
    path: string;
    custom: boolean;
    editing: IEditing;
    selected: boolean;
}

export interface INewInformation {
    shells: string[];
    shell: string;
    pwd: string;
    env: IEnvironment[];
}

@Component({
    selector: 'app-sidebar-app-shell-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellInputComponent implements OnInit, AfterContentInit, OnDestroy {

    @ViewChild(MatInput) _inputComRef: MatInput;
    @ViewChild(MatAutocompleteTrigger) _ng_autoComRef: MatAutocompleteTrigger;
    @ViewChild('requestinput') _ng_requestInputComRef: ElementRef;

    @Input() public service: ShellService;

    public _ng_inputCtrl = new FormControl();
    public _ng_commands: Observable<ISortedFile[]>;
    public _ng_recent: Observable<IPair[]>;
    public _ng_information: INewInformation = {
        env: [],
        pwd: '',
        shell: '',
        shells: []
    };

    private _sessionID: string;
    private _recent: IPair[] = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellInputComponent');
    private _selectedTextOnInputClick: boolean = false;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};

    constructor(private _sanitizer: DomSanitizer) {
        this._sessionID = TabsSessionsService.getActive().getGuid();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
    }

    public ngOnInit() {
        this._restoreEnvironment();
    }

    public ngAfterContentInit() {
        this._loadRecentCommands();
        this._ng_recent = this._ng_inputCtrl.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value))
        );
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onKeyDownRequestInput(event: KeyboardEvent): boolean {
        if (event.key === 'Tab' || event.key === 'ArrowRight') {
            if (this._ng_autoComRef.activeOption) {
                this._ng_inputCtrl.setValue(this._ng_autoComRef.activeOption.value.description);
            }
            return false;
        }
        return true;
    }

    public _ng_onKeyUpRequestInput(event?: KeyboardEvent) {
        if (event !== undefined && event.key !== 'Enter' && event.key !== 'Escape') {
            return;
        }
        if (event !== undefined && event.key === 'Escape') {
            if (this._ng_inputCtrl.value !== '') {
                this._ng_inputCtrl.setValue('');
            } else {
                this._blur();
            }
            return;
        }
        if (this._ng_inputCtrl.value === '') {
            return;
        }
        const command = this._ng_inputCtrl.value;
        this._ng_inputCtrl.setValue('');
        this._ng_autoComRef.closePanel();
        this._runCommand(command);
    }

    public _ng_onFocusRequestInput() {
        this._ng_autoComRef.openPanel();
        if (this._ng_inputCtrl.value === '') {
            return;
        }
    }

    public _ng_onClickRequestInput() {
        if (this._selectedTextOnInputClick) {
            return;
        }
        this._selectedTextOnInputClick = true;
        this._selectTextInInput();
    }

    public _ng_onBlurRequestInput() {
        setTimeout(() => {
            if (this._ng_autoComRef === undefined) {
                return;
            }
            this._ng_autoComRef.closePanel();
        }, 250);
        this._selectedTextOnInputClick = false;
    }

    public _ng_onAutocompletePanelOpen() {
        if (this._ng_autoComRef === undefined || this._ng_autoComRef === null) {
            return;
        }
        this._ng_autoComRef.updatePosition();
    }

    public _ng_onRecentSelected(event: MatAutocompleteSelectedEvent) {
        this._ng_inputCtrl.setValue(event.option.viewValue);
        if (!this._selectedTextOnInputClick) {
            this._ng_onKeyUpRequestInput();
        }
    }

    public _ng_getSafeHTML(input: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(input);
    }

    public _ng_onClearRecent() {
        this._ng_autoComRef.closePanel();
        this._ng_inputCtrl.updateValueAndValidity();
        this.service.clearRecent().then(() => {
            this._loadRecentCommands();
        }).catch((error: string) => {
            this._logger.error(error);
        });
    }

    public _ng_onEnvironment() {
        PopupsService.add({
            id: 'environment-settings-dialog',
            caption: `Environment settings`,
            component: {
                factory: SidebarAppShellEnvironmentComponent,
                inputs: {
                    information: this._ng_information,
                    setEnvironment: (information: INewInformation) => {
                        const environment: { [variable: string]: string } = {};
                        information.env.forEach((env: IEnvironment) => {
                            environment[env.variable] = env.path;
                        });
                        this.service.setEnv({
                            session: this._sessionID,
                            env: environment,
                        });
                    }
                }
            },
            buttons: [ ],
            options: {
                width: 60,
            }
        });
    }

    public _ng_onSetPwd() {
        const popupId: string = PopupsService.add({
            id: 'environment-pwd-dialog',
            caption: `Set Pwd`,
            component: {
                factory: SidebarAppShellInputPwdComponent,
                inputs: {
                    service: this.service,
                    sessionID: this._sessionID,
                    pwd: this._ng_information.pwd.slice(),
                    setPwd: (pwd: string) => {
                        this._ng_information.pwd = pwd;
                    },
                    close: () => {
                        PopupsService.remove(popupId);
                    }
                }
            },
            buttons: [ ],
            options: {
                width: 20,
            }
        });
    }

    public _ng_onSelectShell(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: 'Select shell',
                disabled: true,
            }
        ];
        this._ng_information.shells.forEach((shell: string) => {
            items.push({
                caption: shell,
                handler: () => {
                    this._ng_information.shell = shell;
                    this.service.setEnv({ session: this._sessionID, shell: shell }).catch((error: string) => {
                        this._logger.error(error);
                    });
                }
            });
        });
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    private _loadRecentCommands() {
        this.service.loadRecentCommands().then((recentCommands: IPair[]) => {
            this._recent = recentCommands;
            this._ng_inputCtrl.updateValueAndValidity();
        }).catch((error: string) => {
            this._logger.error(error);
        });
    }

    private _runCommand(command: string) {
        this.service.runCommand(
            {
                session: this._sessionID,
                command: command,
                pwd: this._ng_information.pwd,
                shell: this._ng_information.shell,
            }).then(() => {
            this._addRecentCommand(command);
            this._ng_inputCtrl.updateValueAndValidity();
        }).catch((error: string) => {
            this._logger.error(error);
        });
    }

    private _selectTextInInput() {
        setTimeout(() => {
            if (this._ng_requestInputComRef === undefined || this._ng_requestInputComRef === null) {
                return;
            }
            const input: HTMLInputElement = (this._ng_requestInputComRef.nativeElement as HTMLInputElement);
            input.setSelectionRange(0, input.value.length);
        });
    }

    private _blur() {
        if (this._ng_requestInputComRef === undefined || this._ng_requestInputComRef === null) {
            return;
        }
        (this._ng_requestInputComRef.nativeElement as HTMLInputElement).blur();
    }

    private _filter(value: string): IPair[] {
        if (typeof value !== 'string') {
            return;
        }
        const scored = sortPairs(this._recent, value, value !== '', 'span');
        return scored;
    }

    private _addRecentCommand(command: string) {
        let exists: boolean = false;
        this._recent.forEach((recent: IPair) => {
            if (recent.description === command) {
                exists = true;
                return;
            }
        });
        if (!exists) {
            this._recent.unshift(        {
                id: '',
                caption: ' ',
                description: command,
                tcaption: ' ',
                tdescription: command
            });
        }
    }

    private _restoreEnvironment() {
        this.service.getEnv({ session: this._sessionID }).then((information: IInformation) => {
            this._ng_information.pwd = information.pwd;
            this._ng_information.shell = information.shell;
            this._ng_information.shells = information.shells;
            this._ng_information.env = [];
            Object.keys(information.env).forEach((variable: string) => {
                this._ng_information.env.push({
                    path: information.env[variable],
                    variable: variable,
                    custom: false,
                    editing: {
                        path: false,
                        variable: false,
                    },
                    selected: false,
                });
            });
        }).catch((error: string) => {
            this._logger.error(error);
        });
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID = session.getGuid();
            this._restoreEnvironment();
        }
    }

}
