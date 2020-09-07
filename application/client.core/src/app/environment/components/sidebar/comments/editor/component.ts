import { Component, OnDestroy, ChangeDetectorRef, Input, OnChanges, AfterContentInit, AfterViewInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerFileMergeSession, IMergeFile, IFileOptions } from '../../../../controller/controller.file.merge.session';
import { CColors } from '../../../../conts/colors';
import { getContrastColor } from '../../../../theme/colors';
import { IPCMessages } from '../../../../interfaces/interface.ipc';
import { NotificationsService, ENotificationType } from '../../../../services.injectable/injectable.service.notifications';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-comments-editor',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class SidebarAppCommentsEditorComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer,
                private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
