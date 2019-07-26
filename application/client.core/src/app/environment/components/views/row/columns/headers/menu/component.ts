import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { ControllerColumns, IColumn, IColumns } from '../../controller.columns';
import { CColors } from '../../../../../../conts/colors';

export const CColumnsHeadersKey = 'CColumnsHeadersKey';

@Component({
    selector: 'app-views-output-row-columns-headers-contextmenu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputRowColumnsHeadersMenuComponent implements OnDestroy, AfterContentInit {

    @Input() public controller: ControllerColumns;

    public _ng_columns: IColumns = {};
    public _ng_selected: number | undefined = undefined;
    public _ng_colors: string[] = CColors;

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
        this._ng_columns = this.controller.getColumns();
        this._forceUpdate();
    }

    public _ng_onColorMouseDown(event: MouseEvent, color: string) {
        if (this._ng_selected !== undefined) {
            this._ng_columns[this._ng_selected].color = CColors[0] === color ? undefined : color;
        }
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        this._forceUpdate();
        return false;
    }

    public _ng_onColumnMouseDown(event: MouseEvent, index: number) {
        if (this._ng_selected === index) {
            this._ng_selected = undefined;
        } else {
            this._ng_selected = index;
        }
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        this._forceUpdate();
        return false;
    }

    public _ng_onChange(index: number) {
        this._ng_columns[index].visible = !this._ng_columns[index].visible;
    }

    public _ng_apply() {
        this.controller.setColumns(this._ng_columns);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }


}
