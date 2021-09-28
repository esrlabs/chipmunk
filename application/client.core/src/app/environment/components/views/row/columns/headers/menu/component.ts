import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { ControllerColumns, IColumn } from '../../controller.columns';
import { CColors } from '../../../../../../conts/colors';
import ContextMenuService from '../../../../../../services/standalone/service.contextmenu';

export const CColumnsHeadersKey = 'CColumnsHeadersKey';

@Component({
    selector: 'app-views-output-row-columns-headers-contextmenu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewOutputRowColumnsHeadersMenuComponent
    implements OnDestroy, AfterContentInit, AfterViewInit
{
    @Input() public controller!: ControllerColumns;
    @Input() public header!: string;

    public _ng_columns: IColumn[] = [];
    public _ng_selected: number | undefined = undefined;
    public _ng_colors: string[] = CColors;

    private _destroyed: boolean = false;
    private _checkBoxClicked: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

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

    public ngAfterViewInit() {
        this._ng_onColumnMouseDown(new MouseEvent(''), this.index);
    }

    public _ng_onColorMouseDown(event: MouseEvent, color: string) {
        if (this._ng_selected !== undefined) {
            this._ng_columns[this._ng_selected].color = CColors[0] === color ? undefined : color;
        }
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        this._setColumns();
        this._forceUpdate();
        return false;
    }

    public _ng_onColumnMouseDown(event: MouseEvent, index: number) {
        if (!this._checkBoxClicked) {
            if (this._ng_selected === index) {
                this._ng_onChange(index);
            } else {
                this._ng_selected = index;
            }
        }
        this._checkBoxClicked = false;
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        this._forceUpdate();
        return false;
    }

    public _ng_onCheckBoxMouseDown(event: MouseEvent, index: number) {
        this._checkBoxClicked = true;
    }

    public _ng_onChange(index: number) {
        this._ng_columns[index].visible = !this._ng_columns[index].visible;
        this._setColumns();
    }

    public _ng_apply() {
        this._setColumns();
        ContextMenuService.remove();
    }

    public _setColumns() {
        this.controller.setColumns(this._ng_columns);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

    private get index(): number {
        for (let i = 0; i < this._ng_columns.length; i++) {
            if (this._ng_columns[i].header === this.header) {
                return i;
            }
        }
        return 0;
    }
}
