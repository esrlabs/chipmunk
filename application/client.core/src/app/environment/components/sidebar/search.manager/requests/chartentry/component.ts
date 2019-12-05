// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, HostListener, AfterContentInit, OnChanges, ViewChild } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import { IChartRequest, EChartType } from '../../../../../controller/controller.session.tab.search.charts';
import { Subscription, Subject, Observable } from 'rxjs';
import { InputStandardComponent } from 'chipmunk-client-primitive';

export interface IChartItem {
    request: IChartRequest;
    onSelect: () => void;
    onEdit: Observable<IChartRequest>;
    onEditCancel: Observable<void>;
    onEditDone: (value?: string) => void;
    onChangeState: (active: boolean) => void;
}

const CChartTypeIconMap = {
    [EChartType.stepped]: 'fas fa-chart-area',
    [EChartType.smooth]: 'fas fa-chart-line',
};

@Component({
    selector: 'app-sidebar-app-search-chartentry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchChartEntryComponent implements OnDestroy, AfterContentInit, OnChanges {

    @ViewChild('input', {static: false}) _inputComRef: InputStandardComponent;

    @Input() public chart: IChartItem;

    public _ng_request: string = '';
    public _ng_active: boolean = true;
    public _ng_color: string = '';
    public _ng_type: EChartType = EChartType.stepped;
    public _ng_typeCssClass: string = CChartTypeIconMap[EChartType.stepped];
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
        this.chart.onSelect();
    }

    public ngAfterContentInit() {
        this._subscriptions.onEdit = this.chart.onEdit.subscribe(this._onEdit.bind(this));
        this._subscriptions.onEditCancel = this.chart.onEditCancel.subscribe(this._onEditCancel.bind(this));
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
        this.chart.onChangeState(this._ng_active);
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
        this.chart.onEditDone(value);
    }

    public _ng_onValueChange(value: string) {
        this._ng_request = value;
    }

    public _ng_onValueKeyUp(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.chart.onEditDone();
        }
    }

    private _update() {
        if (this.chart === undefined) {
            return;
        }
        this._ng_request = this.chart.request.reg.source;
        this._ng_color = this.chart.request.color;
        this._ng_active = this.chart.request.active;
        this._ng_type = this.chart.request.type;
        this._ng_typeCssClass = CChartTypeIconMap[this._ng_type];
        this._cdRef.detectChanges();
    }

    private _onEdit(request: IChartRequest) {
        if (request.reg.source !== this.chart.request.reg.source) {
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
        this.chart.onEditDone();
    }

}
