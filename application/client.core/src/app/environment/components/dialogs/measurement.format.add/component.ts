import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterContentInit } from '@angular/core';
import { IFormat, ControllerSessionTabTimestamp } from '../../../controller/controller.session.tab.timestamp';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ForamtErrorStateMatcher implements ErrorStateMatcher {
    private _controller: ControllerSessionTabTimestamp;
    private _update: () => void;
    private _valid: boolean = true;
    private _error: string | undefined;
    private _last_checked: string = '';

    constructor(controller: ControllerSessionTabTimestamp, update: () => void) {
        this._controller = controller;
        this._update = update;
    }

    public isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
        const valid = this._valid;
        if (this._last_checked !== control.value) {
            this._last_checked = control.value;
            this._controller.validate(control.value).then(() => {
                this._valid = true;
                this._error = undefined;
            }).catch((error: Error) => {
                this._valid = false;
                this._error = error.message;
            }).finally(() => {
                if (valid !== this._valid) {
                    this._update();
                }
            });
        }
        return !this._valid;
    }

    public isValid(): boolean {
        return this._valid;
    }

    public getError(): string | undefined {
        return this._error;
    }

}

@Component({
    selector: 'app-views-dialogs-measurement-add-format',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsMeasurementAddFormatComponent implements AfterViewInit, AfterContentInit, OnDestroy {

    @Input() controller: ControllerSessionTabTimestamp;
    @Input() add: (format: IFormat) => void;
    @Input() cancel: () => void;

    public _ng_format_error: ForamtErrorStateMatcher;
    public _ng_format: string = '';
    public _ng_disabled: boolean = true;

    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsMeasurementAddFormatComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    ngAfterContentInit() {
        this._ng_format_error = new ForamtErrorStateMatcher(this.controller, this._forceUpdate.bind(this));
    }

    ngAfterViewInit() {
    }

    ngOnDestroy() {

    }

    public _ng_onFormatChange() {
        if (this.controller === undefined) {
            return;
        }
    }

    public _ng_add() {
        this.controller.validate(this._ng_format).then((regexp: RegExp) => {
            this.add({
                format: this._ng_format,
                regexp: regexp,
            });
        }).catch((error: Error) => {
            this._logger.warn(`Fail get regexp from datetime format: `);
        });
    }

    public _ng_cancel() {
        this.cancel();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._ng_disabled = !this._ng_format_error.isValid();
        this._cdRef.detectChanges();
    }

}
