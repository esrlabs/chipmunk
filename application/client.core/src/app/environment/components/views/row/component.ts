import * as Toolkit from 'chipmunk.client.toolkit';

import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewChild, ElementRef, AfterViewInit, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from '../../../controller/session/dependencies/output/controller.session.tab.stream.output';
import { ControllerSessionTabStreamBookmarks, IBookmark } from '../../../controller/session/dependencies/bookmarks/controller.session.tab.stream.bookmarks';
import { ControllerSessionScope, IRowNumberWidthData } from '../../../controller/session/dependencies/scope/controller.session.tab.scope';
import { ControllerSessionTabTimestamp } from '../../../controller/session/dependencies/timestamps/session.dependency.timestamps';
import { IComponentDesc } from 'chipmunk-client-material';
import { AOutputRenderComponent } from '../../../interfaces/interface.output.render';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { ENotificationType } from '../../../../../../../common/ipc/electron.ipc.messages/index';
import { scheme_color_accent } from '../../../theme/colors';
import { EParent } from '../../../services/standalone/service.output.redirections';
import { IRowAPI, ControllerRowAPI } from '../../../controller/session/dependencies/row/controller.row.api';

import SourcesService from '../../../services/service.sources';
import OutputParsersService from '../../../services/standalone/service.output.parsers';
import SelectionParsersService from '../../../services/standalone/service.selection.parsers';
import OutputRedirectionsService from '../../../services/standalone/service.output.redirections';
import ViewsEventsService from '../../../services/standalone/service.views.events';
import TabsSessionsService from '../../../services/service.sessions.tabs';

 enum ERenderType {
    standard = 'standard',
    external = 'external',
    columns = 'columns',
}

export interface IScope { [key: string]: any; }

export const CRowLengthLimit = 10000;

interface ITooltip {
    content: string;
    top: number;
    left: number;
}

@Component({
    selector: 'app-views-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // encapsulation: ViewEncapsulation.None
})

export class ViewOutputRowComponent implements AfterContentInit, AfterContentChecked, OnDestroy, AfterViewInit {

    @ViewChild('rendercomp') rendercomp: AOutputRenderComponent;
    @ViewChild('numbernode') numbernode: ElementRef;

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public positionInStream: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public rank: number = 1;
    @Input() public parent: EParent;
    @Input() public api: ControllerRowAPI;

    public _ng_sourceName: string | undefined;
    public _ng_number: string | undefined;
    public _ng_number_filler: string | undefined;
    public _ng_bookmarked: boolean = false;
    public _ng_sourceColor: string | undefined;
    public _ng_component: IComponentDesc | undefined;
    public _ng_render: ERenderType = ERenderType.standard;
    public _ng_render_api: any;
    public _ng_numberDelimiter: string = '\u0008';
    public _ng_error: string | undefined;
    public _ng_tooltip: ITooltip | undefined;

    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _sourceMeta: string | undefined;
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger(`RowWrapper`);
    private _hovered: number = -1;
    private _guid: string = Toolkit.guid();

    @HostListener('mouseover', ['$event', '$event.target']) onMouseIn(event: MouseEvent, target: HTMLElement) {
        if (target === undefined || target === null) {
            return;
        }
        ViewsEventsService.fire().onRowHover(this._getPosition());
        OutputParsersService.getTooltipContent(target, this.str, this._getPosition()).then((content: string | undefined) => {
            if (content === undefined) {
                return;
            }
            this._ng_tooltip = {
                content: content,
                top: 0,
                left: event.clientX,
            };
            this._forceUpdate();
        }).catch((err: Error) => {
            this._logger.debug(`Fail get tooltip content due error: ${err.message}`);
        });
    }

    @HostListener('mouseout', ['$event.target']) onMouseOut() {
        if (this._ng_tooltip === undefined) {
            return;
        }
        ViewsEventsService.fire().onRowHover(-1);
        this._ng_tooltip = undefined;
        this._forceUpdate();
    }

    @HostListener('mouseleave', ['$event.target']) onMouseLeave() {
        if (this._ng_tooltip === undefined) {
            return;
        }
        ViewsEventsService.fire().onRowHover(-1);
        this._ng_tooltip = undefined;
        this._forceUpdate();
    }

    @HostListener('mousemove', ['$event']) onMouseMove(event: MouseEvent) {
        if (this._ng_tooltip === undefined) {
            return;
        }
        this._ng_tooltip.left = event.clientX;
        this._forceUpdate();
    }

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
    }

    public ngOnDestroy() {
        this.api.unregister(this._guid);
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public ngAfterContentInit() {
        if (this.api === undefined) {
            return;
        }
        if (this._subscriptions.onRankChanged !== undefined) {
            return;
        }
        if (typeof this.str === 'string' && this.str.length > CRowLengthLimit) {
            const length: number = this.str.length;
            this.str = `${this.str.substr(0, CRowLengthLimit)}... [this line has ${length} chars. It's cropped to ${CRowLengthLimit}]`;
            this._ng_error = `Row #${this._getPosition()} has length ${length} chars. Row is cropped to ${CRowLengthLimit}.`;
            this._notifications.add({
                caption: 'Length limit',
                message: this._ng_error,
                options: {
                    type: ENotificationType.warning,
                    once: true,
                }
            });
        }
        const sourceName: string | undefined = SourcesService.getSourceName(this.pluginId);
        if (sourceName === undefined) {
            this._ng_sourceName = 'n/d';
        } else {
            this._ng_sourceName = sourceName;
        }
        this._sourceMeta = SourcesService.getSourceMeta(this.pluginId);
    }

    public ngAfterContentChecked() {
        if (this._getPosition().toString() === this._ng_number) {
            return;
        }
        this._ng_bookmarked = this.api.getBookmarks().isBookmarked(this._getPosition());
        if (this.str === undefined) {
            this._pending();
        } else {
            this._render();
        }
    }

    public ngAfterViewInit() {
        this.api.register(this._guid, this._api());
        this._checkNumberNodeWidth();
    }

    public _ng_onContextMenu(event: MouseEvent) {
        SelectionParsersService.setContextRowNumber(this._getPosition());
    }

    public _ng_getAdditionCssClass(): string {
        let css: string = '';
        if (this._ng_bookmarked) {
            css += ' bookmarked ';
        }
        if (this._ng_isSelected()) {
            css += ' selected ';
        }
        if (this.api.getTimestamp().getCount() > 0) {
            css += ' timeranges ';
        }
        return css;
    }

    public _ng_isPending() {
        return this.str === undefined;
    }

    public _ng_onRowSelect(event: MouseEvent) {
        if (OutputParsersService.emitClickHandler(event.target as HTMLElement, this.str, this._getPosition())) {
            event.stopImmediatePropagation();
            event.preventDefault();
        } else {
            OutputRedirectionsService.select(this.parent, this.sessionId, this._getPosition(), this.str);
            if (this.pluginId === -1) {
                return;
            }
            if (TabsSessionsService.getActive() === undefined) {
                return;
            }
            TabsSessionsService.getPluginAPI(this.pluginId).getViewportEventsHub().getSubject().onRowSelected.emit({
                session: this.sessionId,
                source: {
                    id: this.pluginId,
                    name: this._ng_sourceName,
                },
                str: this.str,
                row: this._getPosition(),
            });
        }
    }

    public _ng_onNumberClick() {
        if (this.api === undefined) {
            return;
        }
        if (this.api.getBookmarks().isBookmarked(this._getPosition())) {
            this.api.getBookmarks().remove(this._getPosition());
            this._ng_bookmarked = false;
        } else {
            this.api.getBookmarks().add({
                str: this.str,
                position: this._getPosition(),
                pluginId: this.pluginId,
                rank: this.rank,
            });
            this._ng_bookmarked = true;
        }
        this._forceUpdate();
    }

    public _ng_isSelected(): boolean {
        if (this.api.getStreamOutput() === undefined) {
            return false;
        }
        return OutputRedirectionsService.isSelected(this.sessionId, this._getPosition());
    }

    public _ng_getRangeCssClass(): string {
        const type = this.api.getTimestamp().getStatePositionInRange(this._getPosition());
        return type === undefined ? (this.api.getTimestamp().getOpenRow() !== undefined ? 'opening' : '') : type;
    }

    public _ng_getRangeStyle(): { [key: string]: string } {
        const type = this.api.getTimestamp().getStatePositionInRange(this._getPosition());
        if (type === 'open') {
            return {};
        }
        const row = this.api.getTimestamp().getOpenRow();
        const position: number = this._getPosition();
        const color: string | undefined = this.api.getTimestamp().getRangeColorFor(position);
        if (row === undefined) {
            return {
                borderColor: color,
            };
        }
        if (color === undefined && this._hovered !== -1) {
            if ((row.position < this._hovered && position >= row.position && position <= this._hovered) ||
                (row.position > this._hovered && position <= row.position && position >= this._hovered)) {
                return {
                    borderColor: scheme_color_accent,
                    borderWidth: '2px'
                };
            }
        }
        return {
            borderColor: color,
        };
    }

    public _ng_getRangeColor(): string | undefined {
        return this.api.getTimestamp().getRangeColorFor(this._getPosition());
    }

    public _ng_getTooltipStyle() {
        return this._ng_tooltip === undefined ? {} : {
            top: `${this._ng_tooltip.top}px`,
            left: `${this._ng_tooltip.left}px`,
        };
    }

    public _ng_isRangeVisible(): boolean {
        if (this.api.getTimestamp().getOpenRow() !== undefined) {
            return true;
        }
        if (this._ng_getRangeColor() !== undefined) {
            return true;
        }
        return false;
    }

    private _api(): IRowAPI {
        const self = this;
        return {
            repain(): void {
                if (self.str === undefined) {
                    return;
                }
                self._render();
                self._forceUpdate();
            },
            refresh(): void {
                self._forceUpdate();
            },
            setBookmark(bookmark: IBookmark): void {
                const prev: boolean = self._ng_bookmarked;
                self._ng_bookmarked = self._getPosition() === bookmark.position ? true : self._ng_bookmarked;
                if (prev !== self._ng_bookmarked) {
                    self._forceUpdate();
                }
            },
            removeBookmark(index: number): void {
                const prev: boolean = self._ng_bookmarked;
                self._ng_bookmarked = self._getPosition() === index ? false : self._ng_bookmarked;
                if (prev !== self._ng_bookmarked) {
                    self._forceUpdate();
                }
            },
            setHoverPosition(position: number): void {
                self._hovered = position;
                if (self._ng_tooltip === undefined && self.api.getTimestamp().getOpenRow() === undefined) {
                    return;
                }
                self._ng_tooltip = undefined;
                self._forceUpdate();
            },
            resize(scope: ControllerSessionScope): void {
                const info: IRowNumberWidthData | undefined = scope.get(ControllerSessionScope.Keys.CRowNumberWidth);
                if (info === undefined) {
                    return;
                }
                if (info.checked) {
                    return;
                }
                scope.set<any>(ControllerSessionScope.Keys.CRowNumberWidth, {
                    checked: true,
                }, false);
                self._checkNumberNodeWidth(true);
            },
            setRank(rank: number): void {
                self.rank = rank;
                self._ng_number_filler = self._getNumberFiller();
                self._forceUpdate();
                self._checkNumberNodeWidth();
            }
        };
    }

    private _getPosition(): number | undefined {
        if (this.parent === EParent.output) {
            return this.position;
        } else if (this.parent === EParent.search) {
            return this.positionInStream;
        }
    }

    private _render() {
        if (this.pluginId === -1) {
            return;
        }
        this._ng_render = ERenderType.standard;
        this._ng_component = undefined;
        this._ng_render_api = undefined;
        this._ng_sourceColor = SourcesService.getSourceColor(this.pluginId);
        this._ng_number = this._getPosition().toString();
        this._ng_number_filler = this._getNumberFiller();
        const render: Toolkit.ATypedRowRender<any> | undefined = OutputParsersService.getTypedRowRender(this._ng_sourceName, this._sourceMeta);
        if (render === undefined) {
            this._ng_render = ERenderType.standard;
            return this._updateRenderComp();
        }
        switch (render.getType()) {
            case Toolkit.ETypedRowRenders.columns:
                this._ng_render = ERenderType.columns;
                this._ng_render_api = render.getAPI();
                break;
            case Toolkit.ETypedRowRenders.external:
                this._ng_render = ERenderType.external;
                this._ng_component = {
                    factory: (render.getAPI() as Toolkit.ATypedRowRenderAPIExternal).getFactory(),
                    resolved: true,
                    inputs: (render.getAPI() as Toolkit.ATypedRowRenderAPIExternal).getInputs()
                };
                break;
        }
        // Update render component
        this._updateRenderComp();
    }

    private _pending() {
        this._ng_number = this._getPosition().toString();
        this._ng_number_filler = this._getNumberFiller();
        this._ng_component = undefined;
    }

    private _getNumberFiller(): string {
        if (this._ng_number === undefined) {
            return '';
        }
        const rank = this.rank - this._ng_number.length;
        return '0'.repeat(rank < 0 ? 0 : rank);
    }

    private _updateRenderComp() {
        if (this.rendercomp === undefined || this.rendercomp === null) {
            return;
        }
        this.rendercomp.update({
            str: this.str,
            sessionId: this.sessionId,
            pluginId: this.pluginId,
            position: this._getPosition(),
            scope: this.api.getScope(),
            output: this.api.getStreamOutput(),
        });
    }

    private _checkNumberNodeWidth(force: boolean = false) {
        if (this.numbernode === undefined) {
            return;
        }
        if (this.api.getScope() === undefined) {
            return;
        }
        const info: IRowNumberWidthData | undefined = this.api.getScope().get(ControllerSessionScope.Keys.CRowNumberWidth);
        if (info === undefined) {
            return;
        }
        if (info.rank === this.rank && info.width !== 0 && !force) {
            return;
        }
        const size: ClientRect = (this.numbernode.nativeElement as HTMLElement).getBoundingClientRect();
        if (size.width === 0 || info.width === size.width) {
            return;
        }
        this.api.getScope().set<any>(ControllerSessionScope.Keys.CRowNumberWidth, {
            rank: this.rank,
            width: size.width,
        }, false);
        info.onChanged.next();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
