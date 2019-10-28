// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, HostListener, AfterContentInit, OnChanges, ViewChild } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import { IRequest } from '../../../../../controller/controller.session.tab.search';
import { Subscription, Subject, Observable } from 'rxjs';
import { InputStandardComponent } from 'chipmunk-client-primitive';

export interface IRequestItem {
    request: IRequest;
    onSelect: () => void;
    onEdit: Observable<IRequest>;
    onEditCancel: Observable<void>;
    onEditDone: (value?: string) => void;
    onChangeState: (active: boolean) => void;
}

@Component({
    selector: 'app-sidebar-app-search-request',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchRequestComponent implements OnDestroy, AfterContentInit, OnChanges {

    @ViewChild('input') _inputComRef: InputStandardComponent;

    @Input() public request: IRequestItem;

    public _ng_request: string = '';
    public _ng_active: boolean = true;
    public _ng_color: string = '';
    public _ng_background: string = '';
    public _ng_edit: boolean = false;
    public _ng_shadow: boolean = false;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _prevValue: string | undefined;
    private _focused: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_onValueValidate = this._ng_onValueValidate.bind(this);
        this._ng_onValueEnter = this._ng_onValueEnter.bind(this);
        this._ng_onValueChange = this._ng_onValueChange.bind(this);
        this._ng_onValueBlur = this._ng_onValueBlur.bind(this);
        this._ng_onValueKeyUp = this._ng_onValueKeyUp.bind(this);
    }

    @HostListener('click', ['$event']) public onClick(event: MouseEvent) {
        this.request.onSelect();
    }

    public ngAfterContentInit() {
        this._subscriptions.onEdit = this.request.onEdit.subscribe(this._onEdit.bind(this));
        this._subscriptions.onEditCancel = this.request.onEditCancel.subscribe(this._onEditCancel.bind(this));
        this._update();
    }

    public ngOnChanges() {
        this._update();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onChangeState(event: MouseEvent) {
        this._ng_active = !this._ng_active;
        this.request.onChangeState(this._ng_active);
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
    }

    public _ng_onValueValidate(value: string): string | undefined {
        if (value.trim() === '' || !Toolkit.regTools.isRegStrValid(value)) {
            return `Invalid regular expression`;
        }
        return undefined;
    }

    public _ng_onValueEnter(value: string, event: KeyboardEvent) {
        this._drop();
        this._ng_request = value;
        event.stopImmediatePropagation();
        event.preventDefault();
        this.request.onEditDone(value);
    }

    public _ng_onValueChange(value: string) {
        this._ng_request = value;
    }

    public _ng_onValueKeyUp(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.request.onEditDone();
        }
    }

    private _update() {
        if (this.request === undefined) {
            return;
        }
        this._ng_request = this.request.request.reg.source;
        this._ng_color = this.request.request.color;
        this._ng_background = this.request.request.background;
        this._ng_active = this.request.request.active;
        this._cdRef.detectChanges();
    }

    private _onEdit(request: IRequest) {
        if (request.reg.source !== this.request.request.reg.source) {
            this._ng_shadow = true;
            this._ng_edit = false;
            this._prevValue = undefined;
        } else {
            this._ng_shadow = false;
            this._ng_edit = true;
            this._prevValue = this._ng_request;
        }
        this._cdRef.detectChanges();
        if (this._inputComRef !== undefined) {
            // We need this solution (timer) to resolve issue when edit mode calls from context-menu. Issue was: focus jumps into list but gone on input.
            setTimeout(() => {
                this._inputComRef.focus();
                this._focused = true;
            }, 50);
        }
    }

    private _onEditCancel() {
        if (this._prevValue !== undefined) {
            this._ng_request = this._prevValue;
        }
        this._drop();
        this._cdRef.detectChanges();
    }

    private _drop() {
        this._ng_edit = false;
        this._ng_shadow = false;
        this._prevValue = undefined;
        this._cdRef.detectChanges();
    }

    private _ng_onValueBlur() {
        if (!this._focused) {
            return;
        }
        this.request.onEditDone();
    }

}
