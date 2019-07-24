import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { ControllerColumns, IColumn, IColumns } from '../../controller.columns';

export const CColumnsHeadersKey = 'CColumnsHeadersKey';

@Component({
    selector: 'app-views-output-row-columns-headers-contextmenu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputRowColumnsHeadersMenuComponent implements OnDestroy, AfterContentInit {

    @Input() public controller: ControllerColumns;

    public _ng_columns: string[] = [];
    public _ng_visibility: boolean[] = [];

    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    public ngAfterContentInit() {
        if (this.controller === undefined) {
            return;
        }
        const columns: IColumns = this.controller.getColumns();
        Object.keys(columns).forEach((key: string) => {
            this._ng_columns.push((columns[key].header));
            this._ng_visibility.push((columns[key].visible));
        });
        this._forceUpdate();
    }

    public _ng_onMouseDown(event: MouseEvent) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        return false;
    }

    public _ng_onChange(index: number) {
        this._ng_visibility[index] = !this._ng_visibility[index];
    }

    public _ng_apply() {
        this.controller.setColumnsVisibility(this._ng_visibility);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }


}
