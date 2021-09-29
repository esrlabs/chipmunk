import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { IPreset } from '../../../../../../../../../common/ipc/electron.ipc.messages';
import { ShellService } from '../../services/service';
import { Session } from '../../../../../controller/session/session';
import { pairwise, startWith } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import TabsSessionsService from '../../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../../services/standalone/service.events.session';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-shell-environment-preset',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class SidebarAppShellPresetComponent implements OnInit, OnDestroy {
    @Input() service!: ShellService;

    public _ng_add: boolean = false;
    public _ng_valid: boolean = false;
    public _ng_title: string = '';
    public _ng_control: FormControl = new FormControl();
    public readonly _ng_colors = {
        valid: '#eaeaea',
        invalid: '#fd1515',
    };

    private _prevSelectedTitle: string = 'Default';
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellPresetComponent');
    private _sessionID: string | undefined;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};

    constructor() {
        const session = TabsSessionsService.getActive();
        this._sessionID = session !== undefined ? session.getGuid() : undefined;
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
            return;
        }
        this._subscriptions.onRestored = this.service
            .getObservable()
            .onRestored.subscribe(this._onRestored.bind(this));
        this.service
            .restoreSession({ session: session.getGuid() }, true)
            .then(() => {
                this._onRestored();
            })
            .catch((error: Error) => {
                this._logger.error(error.message);
            });
        this._ng_control.setValue(this.service.selectedPresetTitle);
        this._ng_control.valueChanges
            .pipe(startWith(this._ng_control.value), pairwise())
            .subscribe(([prevTitle, currTitle]) => {
                if (currTitle === this.service.saveAs) {
                    this._ng_add = true;
                } else {
                    this.service
                        .setEnv({
                            session: session.getGuid(),
                            env: this.service.getPreset(currTitle).information.env,
                        })
                        .catch((error: Error) => {
                            this._logger.error(error.message);
                        });
                }
                if (prevTitle !== this.service.saveAs) {
                    this._prevSelectedTitle = prevTitle;
                }
                this.service.selectedPresetTitle = currTitle;
            });
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
        if (event.key === 'Enter' && this._sessionID !== undefined) {
            this._ng_add = false;
            const index = this.service.addPreset(this._ng_title, this._prevSelectedTitle);
            this._ng_title = '';
            this._ng_control.setValue(this.service.presets[index - 1].title);
            this.service.selectedPresetTitle = this.service.presets[index - 1].title;
            this.service.setPreset(this._sessionID).catch((error: Error) => {
                this._logger.error(error.message);
            });
        }
    }

    public _ng_onRemove() {
        if (this._sessionID === undefined) {
            return;
        }
        this.service
            .removePreset({ session: this._sessionID, title: this.service.selectedPresetTitle })
            .catch((error: Error) => {
                this._logger.error(error.message);
            });
        this._ng_control.setValue(this.service.presets[this.service.presets.length - 1].title);
        this._prevSelectedTitle = this.service.selectedPresetTitle;
    }

    public _ng_onReset() {
        this.service.resetSelectedPreset();
    }

    private _titleExits(): boolean {
        return this.service.presets.filter((preset: IPreset) => {
            return preset.title === this._ng_title;
        }).length === 0
            ? false
            : true;
    }

    private _revertSelection() {
        this._ng_add = false;
        this._ng_title = '';
        this._ng_control.setValue(this._prevSelectedTitle);
        this.service.selectedPresetTitle = this._prevSelectedTitle;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        }
    }

    private _onRestored() {
        this._ng_control.setValue(this.service.selectedPresetTitle);
        this._prevSelectedTitle = this.service.selectedPresetTitle;
    }
}
