import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    Input,
    HostListener,
    AfterContentInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerColumns, IColumn } from '../controller.columns';
import {
    ControllerSessionScope,
    IRowNumberWidthData,
} from '../../../../../controller/session/dependencies/scope/controller.session.tab.scope';
import ContextMenuService from '../../../../../services/standalone/service.contextmenu';
import { ViewOutputRowColumnsHeadersMenuComponent } from './menu/component';
import { ControllerRowAPI } from '../../../../../controller/session/dependencies/row/controller.row.api';

export const CColumnsHeadersKey = 'CColumnsHeadersKey';

@Component({
    selector: 'app-views-output-row-columns-headers',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewOutputRowColumnsHeadersComponent
    implements AfterViewInit, OnDestroy, AfterContentInit
{
    @Input() public controller!: ControllerColumns;
    @Input() public api!: ControllerRowAPI;

    public _ng_offset: number = 0;
    public _ng_horScrollOffset: number = 0;
    public _ng_columns: IColumn[] = [];
    public _ng_mouseOverHeader: string = '';
    public _ng_more: string = 'more_horiz';

    private _columns: IColumn[] = [];
    private _cachedMouseX: number = -1;
    private _resizedColumnKey: number = -1;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    @HostListener('contextmenu', ['$event']) public _ng_onContextMenu(event: MouseEvent) {
        const target: HTMLElement = event.target as HTMLElement;
        if (target === undefined || target.innerText === '') {
            return;
        } else if (target.innerText !== this._ng_more) {
            this._ng_mouseOverHeader = (event.target as HTMLElement).innerText;
        } else if (target.previousSibling !== null) {
            target.previousSibling.textContent !== null &&
                (this._ng_mouseOverHeader = target.previousSibling.textContent);
        }
        this._createContextMenu(event);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._unsubscribeToWinEvents();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this.api.getScope().set(CColumnsHeadersKey, false);
    }

    public ngAfterViewInit() {
        if (this.controller === undefined) {
            return;
        }
        this._subscriptions.onHorScrollOffset = this.api
            .getStreamOutput()
            .getObservable()
            .onHorScrollOffset.subscribe(this._onHorScrollOffset.bind(this));
        this._subscriptions.onResized = this.controller
            .getObservable()
            .onResized.subscribe(this._onResized.bind(this));
        this._subscriptions.onUpdated = this.controller
            .getObservable()
            .onUpdated.subscribe(this._onUpdated.bind(this));
        this._columns = this.controller.getColumns();
        this._setColumns();
        this._getOffset();
        this._forceUpdate();
        this._requestOffset();
    }

    public ngAfterContentInit() {
        this._getOffset();
    }

    public _ng_onClick(event: MouseEvent) {
        this._createContextMenu(event);
    }

    public _ng_onMouseOver(header: string) {
        this._ng_mouseOverHeader = header;
        this._forceUpdate();
    }

    public _ng_onMouseOut() {
        this._ng_mouseOverHeader = '';
        this._forceUpdate();
    }

    public _ng_getWidth(key: number): string {
        return `${this._columns[key].width}px`;
    }

    public _ng_onMouseDown(key: number, event: MouseEvent) {
        this._subscribeToWinEvents();
        this._cachedMouseX = event.x;
        this._resizedColumnKey = key;
    }

    public _ng_getOffset(): string {
        return `${this._ng_offset}px`;
    }

    public _ng_getHorScrollOffset(): string {
        return `-${this._ng_horScrollOffset}px`;
    }

    private _createContextMenu(event: MouseEvent) {
        ContextMenuService.show({
            component: {
                factory: ViewOutputRowColumnsHeadersMenuComponent,
                resolved: false,
                inputs: {
                    controller: this.controller,
                    header: this._ng_mouseOverHeader,
                },
            },
            x: event.pageX,
            y: event.pageY,
        });
    }

    private _setColumns() {
        this._ng_columns = this._columns
            .map((column: IColumn) => {
                return Object.assign({}, column);
            })
            .filter((column: IColumn) => {
                return column.visible;
            });
    }

    private _onWindowMouseMove(event: MouseEvent) {
        if (this._cachedMouseX === -1) {
            return;
        }
        const change: number = this._cachedMouseX - event.x;
        this._cachedMouseX = event.x;
        this._offsetResizedColumnWidth(change);
    }

    private _onWindowMouseUp(event: MouseEvent) {
        if (this._cachedMouseX === -1) {
            return;
        }
        this._cachedMouseX = -1;
        this._resizedColumnKey = -1;
    }

    private _subscribeToWinEvents() {
        this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
        this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
        window.addEventListener('mousemove', this._onWindowMouseMove);
        window.addEventListener('mouseup', this._onWindowMouseUp);
    }

    private _unsubscribeToWinEvents() {
        window.removeEventListener('mousemove', this._onWindowMouseMove);
        window.removeEventListener('mouseup', this._onWindowMouseUp);
    }

    private _offsetResizedColumnWidth(offset: number) {
        if (this._resizedColumnKey === -1) {
            return;
        }
        if (this._columns[this._resizedColumnKey] === undefined) {
            return;
        }
        const width: number = this._columns[this._resizedColumnKey].width - offset;
        this._columns[this._resizedColumnKey].width =
            width < this._columns[this._resizedColumnKey].minWidth
                ? this._columns[this._resizedColumnKey].minWidth
                : width;
        this.controller.resize(this._resizedColumnKey, this._columns[this._resizedColumnKey].width);
        this._forceUpdate();
    }

    private _onResized(columns: IColumn[]) {
        if (this._destroyed) {
            return;
        }
        this._columns = columns;
        this._forceUpdate();
    }

    private _onUpdated(columns: IColumn[]) {
        if (this._destroyed) {
            return;
        }
        this._columns = columns;
        this._setColumns();
        this._forceUpdate();
    }

    private _onHorScrollOffset(offset: number) {
        this._ng_horScrollOffset = offset;
        this._forceUpdate();
    }

    private _getOffset() {
        if (this.api === undefined) {
            return;
        }
        const info: IRowNumberWidthData | undefined = this.api
            .getScope()
            .get<IRowNumberWidthData>(ControllerSessionScope.Keys.CRowNumberWidth);
        if (info === undefined) {
            return;
        }
        if (this._subscriptions.onOffsetChange === undefined) {
            this._subscriptions.onOffsetChange = info.onChanged
                .asObservable()
                .subscribe(this._getOffset.bind(this));
        }
        if (this._ng_offset === info.width) {
            return;
        }
        this._ng_offset = info.width;
        this._forceUpdate();
    }

    private _requestOffset() {
        setTimeout(() => {
            const info: IRowNumberWidthData | undefined = this.api
                .getScope()
                .get<IRowNumberWidthData>(ControllerSessionScope.Keys.CRowNumberWidth);
            if (info === undefined) {
                return;
            }
            info.onSizeRequested.next();
        }, 500);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
