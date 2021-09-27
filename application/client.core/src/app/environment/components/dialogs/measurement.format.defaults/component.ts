import {
    Component,
    Input,
    AfterViewInit,
    OnDestroy,
    ChangeDetectorRef,
    ViewContainerRef,
    AfterContentInit,
} from '@angular/core';
import { ControllerSessionTabTimestamp } from '../../../controller/session/dependencies/timestamps/session.dependency.timestamps';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { Subscription } from 'rxjs';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EDatePartType {
    year = 'year',
    month = 'month',
    day = 'day',
}

export class DatePartErrorStateMatcher implements ErrorStateMatcher {
    private _valid: boolean = true;
    private _error: string | undefined;
    private _type: EDatePartType;

    constructor(type: EDatePartType) {
        this._type = type;
    }

    public isErrorState(
        control: FormControl | null,
        form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        const value: number =
            typeof control.value === 'number' ? control.value : parseInt(control.value, 10);
        if (
            control.value !== undefined &&
            control.value !== null &&
            control.value !== '' &&
            (isNaN(value) || !isFinite(value) || !this.isValueValid(value))
        ) {
            this._valid = false;
            this._error = this._getErrorMsg();
        } else {
            this._valid = true;
            this._error = undefined;
        }
        return !this._valid;
    }

    public isValid(): boolean {
        return this._valid;
    }

    public getError(): string | undefined {
        return this._error;
    }

    public isValueValid(value: number | undefined): boolean {
        if (value === undefined) {
            return false;
        }
        switch (this._type) {
            case EDatePartType.day:
                return value >= 1 && value <= 31;
            case EDatePartType.month:
                return value >= 1 && value <= 12;
            case EDatePartType.year:
                return value >= 1974 && value <= 9999;
        }
    }

    private _getErrorMsg(): string {
        switch (this._type) {
            case EDatePartType.day:
                return `Expection 1 >= value <= 31`;
            case EDatePartType.month:
                return `Expection 1 >= value <= 12`;
            case EDatePartType.year:
                return `Expection 1974 >= value <= 9999`;
        }
    }
}

@Component({
    selector: 'app-views-dialogs-measurement-format-defaults',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsMeasurementFormatDefaultsComponent
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @Input() controller!: ControllerSessionTabTimestamp;
    @Input() save!: () => void;
    @Input() cancel!: () => void;

    public _ng_year: number | undefined;
    public _ng_month: number | undefined;
    public _ng_day: number | undefined;
    public _ng_disabled: boolean = false;
    public _ng_year_error!: DatePartErrorStateMatcher;
    public _ng_month_error!: DatePartErrorStateMatcher;
    public _ng_day_error!: DatePartErrorStateMatcher;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementDefaultsComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {}

    ngAfterContentInit() {
        this._ng_year_error = new DatePartErrorStateMatcher(EDatePartType.year);
        this._ng_month_error = new DatePartErrorStateMatcher(EDatePartType.month);
        this._ng_day_error = new DatePartErrorStateMatcher(EDatePartType.day);
        const defs = this.controller.getDefaults();
        this._ng_day = defs.day;
        this._ng_month = defs.month;
        this._ng_year = defs.year;
    }

    ngAfterViewInit() {}

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_save() {
        if (!this._ng_isValid()) {
            return;
        }
        this.controller.setDefaults({
            year: this._ng_year === null ? undefined : this._ng_year,
            month: this._ng_month === null ? undefined : this._ng_month,
            day: this._ng_day === null ? undefined : this._ng_day,
        });
        this.save();
    }

    public _ng_cancel() {
        this.cancel();
    }

    public _ng_isValid(): boolean {
        if (
            (!this._ng_day_error.isValueValid(this._ng_day) &&
                this._ng_day !== undefined &&
                this._ng_day !== null) ||
            (!this._ng_month_error.isValueValid(this._ng_month) &&
                this._ng_month !== undefined &&
                this._ng_month !== null) ||
            (!this._ng_year_error.isValueValid(this._ng_year) &&
                this._ng_year !== undefined &&
                this._ng_year !== null)
        ) {
            return false;
        }
        return true;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
