import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { copy } from '../../../../../../../../../client.libs/chipmunk.client.toolkit/src/tools/tools.object';
import { IPreset } from '../../../../../../../../../common/ipc/electron.ipc.messages';
import { ShellService } from '../../services/service';
import { Session } from '../../../../../controller/session/session';
import { pairwise, startWith } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import TabsSessionsService from '../../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../../services/standalone/service.events.session';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-shell-input-preset',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})

export class SidebarAppShellPresetComponent implements OnInit, OnDestroy {

    @Input() service: ShellService;

    public _ng_add: boolean = false;
    public _ng_valid: boolean = false;
    public _ng_title: string = '';
    public _ng_control: FormControl = new FormControl();
    public _ng_colors = {
        valid: '#eaeaea',
        invalid: '#fd1515',
    };

    private _prevSelected: IPreset;
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellPresetComponent');
    private _sessionID: string;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};

    constructor() {
        this._sessionID = TabsSessionsService.getActive().getGuid();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
    }

    public ngOnInit() {
        this._subscriptions.onRestored = this.service.getObservable().restored.subscribe(this._onRestored.bind(this));
        this.service.restoreSession({ session: this._sessionID }, true).then(() => {
            this._onRestored();
        }).catch((error: Error) => {
            this._logger.error(error.message);
        });
        this._ng_control.setValue(this.service.selectedPreset);
        this._ng_control.valueChanges.pipe(
            startWith(this._ng_control.value),
            pairwise()
        ).subscribe(
            ([ prev, curr ]) => {
                if (curr.title === this.service.saveAs) {
                    this._ng_add = true;
                }
                if (prev !== undefined && prev.title !== this.service.saveAs) {
                    this._prevSelected = prev;
                }
                this.service.selectedPreset = curr;
            }
        );
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onBlur() {
        this._revertSelection();
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this._revertSelection();
            return;
        }
        if (this._ng_title.trim() === '' || this._titleExits()) {
            this._ng_valid = false;
            return;
        }
        this._ng_valid = true;
        if (event.key === 'Enter') {
            this._ng_add = false;
            const index: number = this.service.presets.push({
                title: this._ng_title,
                information: copy(this._prevSelected.information),
                custom: true,
            });
            this._ng_control.setValue(this.service.presets[index - 1]);
            this.service.selectedPreset = this.service.presets[index - 1];
            this.service.setPreset(this._sessionID).catch((error: string) => {
                this._logger.error(error);
            });
        }
    }

    public _ng_onRemove() {
        this.service.presets = this.service.presets.filter((preset: IPreset) => {
            return preset.title !== this.service.selectedPreset.title;
        });
        this.service.removePreset({ session: this._sessionID, title: this.service.selectedPreset.title }).catch((error: string) => {
            this._logger.error(error);
        });
        this._ng_control.setValue(this.service.presets[this.service.presets.length - 1]);
        this.service.selectedPreset = this.service.presets[this.service.presets.length - 1];
        this._prevSelected = this.service.selectedPreset;
    }

    public _ng_onReset() {
        this.service.presets[1].information = copy(this.service.defaultInformation);
        this.service.setPreset(this._sessionID).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    private _titleExits(): boolean {
        return this.service.presets.filter((preset: IPreset) => {
            return preset.title === this._ng_title;
        }).length === 0 ? false : true;
    }

    private _revertSelection() {
        this._ng_add = false;
        this._ng_title = '';
        this._ng_control.setValue(this._prevSelected);
        this.service.selectedPreset = this._prevSelected;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        }
    }

    private _onRestored() {
        this.service.setEnv({
            session: this._sessionID,
            env: Object.assign({}, ...(this.service.selectedPreset.information.env.map(item => ({ [item.variable]: item.value })))),
        }).catch((error: string) => {
            this._logger.error(error);
        });
        this._ng_control.setValue(this.service.selectedPreset);
        this._prevSelected = this.service.selectedPreset;
    }

}
