import { AfterContentInit, Component, ViewChild, ElementRef } from '@angular/core';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { sortPairs, IPair, ISortedFile } from '../../../../thirdparty/code/engine';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import ShellService from '../services/service';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-shell-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellInputComponent implements AfterContentInit {

    @ViewChild(MatInput) _inputComRef: MatInput;
    @ViewChild(MatAutocompleteTrigger) _ng_autoComRef: MatAutocompleteTrigger;
    @ViewChild('requestinput') _ng_requestInputComRef: ElementRef;

    public _ng_inputCtrl = new FormControl();
    public _ng_commands: Observable<ISortedFile[]>;
    public _ng_recent: Observable<IPair[]>;

    private _recent: IPair[] = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellInputComponent');
    private _selectedTextOnInputClick: boolean = false;

    constructor(private _notificationsService: NotificationsService,
                private _sanitizer: DomSanitizer) { }

    public ngAfterContentInit() {
        this._loadRecentCommands();
        this._ng_recent = this._ng_inputCtrl.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value))
        );
    }

    public _ng_onKeyDownRequestInput(event: KeyboardEvent): boolean {
        if (event.key === 'Tab') {
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
        this._addCommand(command);
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

    public _ng_clearRecent() {
        this._ng_autoComRef.closePanel();
        this._ng_inputCtrl.updateValueAndValidity();
        ElectronIpcService.request(new IPCMessages.ShellRecentCommandsClearRequest(), IPCMessages.ShellRecentCommandsClearResponse).then((response: IPCMessages.ShellRecentCommandsClearResponse) => {
            this._loadRecentCommands();
            if (response.error) {
                return this._logger.error(`Fail to reset recent commands due error: ${response.error}`);
            }
        }).catch((error: Error) => {
            return this._logger.error(`Fail send request to reset recent commands due error: ${error.message}`);
        });
    }

    private _runCommand(command: string) {
        ElectronIpcService.request(new IPCMessages.ShellProcessRunRequest({ session: ShellService.session.getGuid(), command: command }), IPCMessages.ShellProcessRunResponse).then((response: IPCMessages.ShellProcessRunResponse) => {
            if (response.error !== undefined) {
                this._logger.error(`Failed to run command due Error: ${response.error}`);
                this._notificationsService.add({
                    caption: 'Fail to run command',
                    message: `Fail to run command ${command} due error: ${response.error}`
                });
            }
        }).catch((error: Error) => {
            this._logger.error(`Failed to run command due Error: ${error.message}`);
            this._notificationsService.add({
                caption: 'Fail to run command',
                message: `Fail to run command ${command} due error: ${error.message}`
            });
        });
    }

    private _addCommand(command: string) {
        ElectronIpcService.request(new IPCMessages.ShellRecentCommandAddRequest({ command: command }), IPCMessages.ShellRecentCommandAddResponse).then((response: IPCMessages.ShellRecentCommandAddResponse) => {
            if (response.error !== undefined) {
                this._logger.error(`Failed to add command to recent commands due Error: ${response.error}`);
            }
        }).catch((error: Error) => {
            this._logger.error(`Failed to add command to recent commands due Error: ${error.message}`);
        });
    }

    private _loadRecentCommands() {
        ElectronIpcService.request(new IPCMessages.ShellRecentCommandsRequest(), IPCMessages.ShellRecentCommandsResponse).then((response: IPCMessages.ShellRecentCommandsResponse) => {
            this._recent = response.commands.map((recent: string) => {
                return {
                    id: '',
                    caption: ' ',
                    description: recent,
                    tcaption: ' ',
                    tdescription: recent
                };
            });
            this._ng_inputCtrl.updateValueAndValidity();
        }).catch((error: Error) => {
            this._logger.error(`Fail to get list of recent commands due error: ${error.message}`);
            this._notificationsService.add({
                caption: 'Fail load recent commands',
                message: `Fail to load recent commands due error: ${error.message}`
            });
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

}
