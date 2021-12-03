import {
    OnInit,
    AfterContentInit,
    Component,
    ViewChild,
    ElementRef,
    Input,
    OnDestroy,
    ViewEncapsulation,
} from '@angular/core';
import { sortPairs, IPair } from '../../../../thirdparty/code/engine';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { Subscription, Observable } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ShellService } from '../services/service';
import { Session } from '../../../../controller/session/session';

import EventsSessionService from '../../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-shell-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class SidebarAppShellInputComponent implements OnInit, AfterContentInit, OnDestroy {
    @ViewChild(MatAutocompleteTrigger) _ng_autoComRef!: MatAutocompleteTrigger;
    @ViewChild('requestinput') _ng_requestInputComRef!: ElementRef;

    @Input() public service!: ShellService;

    public _ng_inputCtrl = new FormControl();
    public _ng_recent!: Observable<IPair[]>;

    private _sessionID: string | undefined;
    private _recent: IPair[] = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellInputComponent');
    private _selectedTextOnInputClick: boolean = false;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};

    constructor(private _sanitizer: DomSanitizer) {
        const session = TabsSessionsService.getActive();
        this._sessionID = session === undefined ? undefined : session.getGuid();
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
    }

    public ngOnInit() {
        const session: Session | undefined = TabsSessionsService.getActive();
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        } else {
            this._logger.error('Session not available');
        }
    }

    public ngAfterContentInit() {
        this._loadRecentCommands();
        this._ng_recent = this._ng_inputCtrl.valueChanges.pipe(
            startWith(''),
            map((value) => this._filter(value)),
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
                this._ng_inputCtrl.setValue(this._ng_autoComRef.activeOption.value);
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

    public _ng_getSafeHTML(input: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(input);
    }

    public _ng_onRemove(command: string) {
        if (this._sessionID === undefined) {
            return;
        }
        this._recent = this._recent.filter((recent: IPair) => {
            return recent.description !== command;
        });
        this.service
            .removeRecentCommand({ session: this._sessionID, command: command })
            .catch((error: Error) => {
                this._logger.error(error.message);
            });
        this._ng_inputCtrl.setValue('');
    }

    private _loadRecentCommands() {
        this.service
            .loadRecentCommands()
            .then((recentCommands: IPair[]) => {
                this._recent = recentCommands;
                this._ng_inputCtrl.updateValueAndValidity();
            })
            .catch((error: Error) => {
                this._logger.error(error.message);
            });
    }

    private _runCommand(command: string) {
        if (this._sessionID === undefined) {
            this._logger.error(`Session ID is unknown`);
            return;
        }
        this.service
            .runCommand({
                session: this._sessionID,
                command: command,
            })
            .then(() => {
                this._addRecentCommand(command);
                this._ng_inputCtrl.updateValueAndValidity();
            })
            .catch((error: Error) => {
                this._logger.error(error.message);
            });
    }

    private _selectTextInInput() {
        setTimeout(() => {
            if (this._ng_requestInputComRef === undefined || this._ng_requestInputComRef === null) {
                return;
            }
            const input: HTMLInputElement = this._ng_requestInputComRef
                .nativeElement as HTMLInputElement;
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
            return [];
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
            this._recent.unshift({
                id: '',
                caption: ' ',
                description: command,
                tcaption: ' ',
                tdescription: command,
            });
        }
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        }
    }
}
