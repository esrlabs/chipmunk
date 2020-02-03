// tslint:disable:no-inferrable-types

import { Component, Input, ChangeDetectorRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import { ENotificationType } from 'chipmunk.client.toolkit';

@Component({
    selector: Toolkit.EViewsTypes.sidebarVertical,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class MypluginComponent implements AfterViewInit, OnDestroy {

    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;
    @Input() public sessions: Toolkit.ControllerSessionsEvents;

    private _logger: Toolkit.Logger = new Toolkit.Logger(`Plugin: myplugin: inj_output_bot:`);
    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) { }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        this._subscriptions.incomeIPCHostMessage = this.api.getIPC().subscribeToHost((message: any) => {
            if (typeof message !== 'object' && message === null) {
                return;
            }
            if (message.streamId !== this.session && message.streamId !== '*') {
                return;
            }
        });
        this._subscriptions.incomeIPCHostMessage = this.api.getIPC().subscribeToHost((message: any) => {
            if (typeof message !== 'object' && message === null) {
                // Unexpected format of message
                return;
            }
            if (message.streamId !== this.session && message.streamId !== '*') {
                // No definition of streamId
                return;
            }
            if (message.event === 'sent') {
                this.api.addNotification({
                    caption: 'Info',
                    message: message.data.msg,
                    options: {
                        type: ENotificationType.info
                    }
                });
            }
        });
        // Subscribe to sessions events
        this._subscriptions.onSessionChange = this.sessions.subscribe().onSessionChange(this._onSessionChange.bind(this));
        this._subscriptions.onSessionOpen = this.sessions.subscribe().onSessionOpen(this._onSessionOpen.bind(this));
        this._subscriptions.onSessionClose = this.sessions.subscribe().onSessionClose(this._onSessionClose.bind(this));
    }

    private _onSessionChange(guid: string) {
        this.session = guid;
    }

    private _onSessionOpen(guid: string) {
        //
    }

    private _onSessionClose(guid: string) {
        //
    }

    public _ng_onRequest() {
        if (this.api) {
            this.api.getIPC().requestToHost({
                stream: this.session,
                command: 'request'
            }, this.session).then((response) => {
                this.api.addNotification({
                    caption: 'Info',
                    message: response.msg,
                    options: {
                        type: ENotificationType.info
                    }
                });
            }).catch((error: Error) => {
                this._logger.error(error);
            });
      } else {
        this._logger.error('No API found!');
      }
    }

    public _ng_onSend() {
        if (this.api) {
            this.api.getIPC().sentToHost({
                stream: this.session,
                command: 'sent'
            }, this.session).catch((error: Error) => {
                this._logger.error(error);
            });
        } else {
            this._logger.error('No API found!');
        }
    }
}
