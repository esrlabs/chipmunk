import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ConnectedField, Field } from '../../../../controller/settings/field.store';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ValueErrorStateMatcher implements ErrorStateMatcher {
    private _field: ConnectedField<any> | Field<any>;
    private _update: () => void;
    private _valid: boolean = true;
    private _error: string | undefined;
    private _last_checked: string = '';

    constructor(field: ConnectedField<any> | Field<any>, update: () => void) {
        this._field = field;
        this._update = update;
    }

    public isErrorState(
        control: FormControl | null,
        form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        const valid = this._valid;
        if (this._last_checked !== control.value) {
            this._last_checked = control.value;
            this._field
                .validate(control.value)
                .then(() => {
                    this._valid = true;
                    this._error = undefined;
                })
                .catch((error: Error) => {
                    this._valid = false;
                    this._error = error.message;
                })
                .finally(() => {
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
    selector: 'app-tabs-settings-element',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class TabSettingsElementComponent implements OnDestroy, AfterContentInit {
    @Input() public field!: ConnectedField<any> | Field<any>;
    @Input() public change!: (value: any) => void;
    @Input() public name: string = '';
    @Input() public description: string = '';

    public _ng_value: any;
    public _ng_value_error!: ValueErrorStateMatcher;

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsElementComponent');

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {}

    public ngAfterContentInit() {
        this._ng_value_error = new ValueErrorStateMatcher(this.field, this._forceUpdate.bind(this));
        this._ng_value = this.field.get();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public _ng_onValueChange(value: any) {
        this.change(value);
    }

    public _ng_getSafeHTML(str: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(str);
    }

    public _ng_min(): number {
        return (this.field as any).min !== undefined ? (this.field as any).min : 0;
    }

    public _ng_max(): number {
        return (this.field as any).max !== undefined ? (this.field as any).max : 0;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
