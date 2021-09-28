import * as Toolkit from 'chipmunk.client.toolkit';

import {
    Component,
    Input,
    AfterContentChecked,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    ViewChild,
    ElementRef,
    AfterViewInit,
    HostListener,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { IBookmark } from '../../../controller/session/dependencies/bookmarks/controller.session.tab.stream.bookmarks';
import {
    ControllerSessionScope,
    IRowNumberWidthData,
} from '../../../controller/session/dependencies/scope/controller.session.tab.scope';
import { IComponentDesc } from 'chipmunk-client-material';
import { AOutputRenderComponent } from '../../../interfaces/interface.output.render';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { ENotificationType } from '../../../../../../../common/ipc/electron.ipc.messages/index';
import { scheme_color_accent } from '../../../theme/colors';
import { EParent } from '../../../services/standalone/service.output.redirections';
import {
    IRowAPI,
    ControllerRowAPI,
} from '../../../controller/session/dependencies/row/controller.row.api';
import { ESource } from '../../../controller/helpers/selection';

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

export interface IScope {
    [key: string]: any;
}

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
export class ViewOutputRowComponent
    implements AfterContentInit, AfterContentChecked, OnDestroy, AfterViewInit
{
    @ViewChild('rendercomp') rendercomp!: AOutputRenderComponent;
    @ViewChild('numbernode') numbernode!: ElementRef;

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public positionInStream: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public parent!: EParent;
    @Input() public api!: ControllerRowAPI;

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

    @HostListener('mouseover', ['$event', '$event.target']) onMouseIn(
        event: MouseEvent,
        target: HTMLElement,
    ) {
        const position = this._getPosition();
        if (
            target === undefined ||
            target === null ||
            this.str === undefined ||
            position === undefined
        ) {
            return;
        }
        ViewsEventsService.fire().onRowHover(position);
        OutputParsersService.getTooltipContent(target, this.str, position)
            .then((content: string | undefined) => {
                if (content === undefined) {
                    return;
                }
                this._ng_tooltip = {
                    content: content,
                    top: 0,
                    left: event.clientX,
                };
                this._forceUpdate();
            })
            .catch((err: Error) => {
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

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {}

    public ngOnDestroy() {
        this._destroyed = true;
        this.api.unregister(this._guid);
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
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
            this.str = `${this.str.substr(
                0,
                CRowLengthLimit,
            )}... [this line has ${length} chars. It's cropped to ${CRowLengthLimit}]`;
            this._ng_error = `Row #${this._getPosition()} has length ${length} chars. Row is cropped to ${CRowLengthLimit}.`;
            this._notifications.add({
                caption: 'Length limit',
                message: this._ng_error,
                options: {
                    type: ENotificationType.warning,
                    once: true,
                },
            });
        }
        const sourceName: string | undefined =
            this.pluginId === undefined ? undefined : SourcesService.getSourceName(this.pluginId);
        if (sourceName === undefined) {
            this._ng_sourceName = 'n/d';
        } else {
            this._ng_sourceName = sourceName;
        }
        this._sourceMeta =
            this.pluginId === undefined ? undefined : SourcesService.getSourceMeta(this.pluginId);
    }

    public ngAfterContentChecked() {
        const position = this._getPosition();
        if (position === undefined) {
            return;
        }
        if (position.toString() === this._ng_number) {
            return;
        }
        this._ng_bookmarked = this.api.getBookmarks().isBookmarked(position);
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

    public _ng_onContextMenu() {
        const position = this._getPosition();
        if (position === undefined) {
            return;
        }
        SelectionParsersService.setContextRowNumber(position);
    }

    public _ng_getAdditionCssClass(): string {
        let css: string = '';
        if (this._ng_bookmarked) {
            css += ' bookmarked ';
        }
        if (this._ng_isSelected()) {
            css += ' selected ';
        }
        return css;
    }

    public _ng_isPending() {
        return this.str === undefined;
    }

    public _ng_onRowSelect(event: MouseEvent) {
        const position = this._getPosition();
        if (position === undefined || this.str === undefined || this.sessionId === undefined) {
            return;
        }
        if (
            OutputParsersService.emitClickHandler(event.target as HTMLElement, this.str, position)
        ) {
            event.stopImmediatePropagation();
            event.preventDefault();
        } else {
            OutputRedirectionsService.select(
                this.parent,
                this.sessionId,
                {
                    output: position,
                    search: this.parent === EParent.search ? this.position : undefined,
                },
                this.str,
            );
            if (this.pluginId === -1 || this.pluginId === undefined) {
                return;
            }
            if (TabsSessionsService.getActive() === undefined) {
                return;
            }
            const events_hub = TabsSessionsService.getPluginAPI(
                this.pluginId,
            ).getViewportEventsHub();
            events_hub !== undefined &&
                events_hub.getSubject().onRowSelected.emit({
                    session: this.sessionId,
                    source: {
                        id: this.pluginId,
                        name: this._ng_sourceName,
                        meta: this._sourceMeta,
                    },
                    str: this.str,
                    row: position,
                });
        }
    }

    public _ng_onNumberClick() {
        const position = this._getPosition();
        if (position === undefined || this.api === undefined || this.pluginId === undefined) {
            return;
        }
        if (this.api.getBookmarks().isBookmarked(position)) {
            this.api.getBookmarks().remove(position);
            this._ng_bookmarked = false;
        } else {
            this.api.getBookmarks().add({
                str: this.str,
                position: position,
                pluginId: this.pluginId,
            });
            this._ng_bookmarked = true;
        }
        this._forceUpdate();
    }

    public _ng_isSelected(): boolean {
        const position = this._getPosition();
        if (
            this.sessionId === undefined ||
            position === undefined ||
            this.api.getStreamOutput() === undefined
        ) {
            return false;
        }
        return OutputRedirectionsService.isSelected(
            this.sessionId,
            position,
            this.parent === EParent.search ? ESource.search : ESource.output,
        );
    }

    public _ng_getRangeCssClass(): string {
        const position = this._getPosition();
        if (position === undefined) {
            return '';
        }
        const type = this.api.getTimestamp().getStatePositionInRange(position);
        return type === undefined
            ? this.api.getTimestamp().getOpenRow() !== undefined
                ? 'opening'
                : ''
            : type;
    }

    public _ng_getRangeStyle(): { [key: string]: string } {
        const position = this._getPosition();
        if (position === undefined) {
            return {};
        }
        const type = this.api.getTimestamp().getStatePositionInRange(position);
        if (type === 'open') {
            return {};
        }
        const row = this.api.getTimestamp().getOpenRow();
        const color: string | undefined = this.api.getTimestamp().getRangeColorFor(position);
        if (row === undefined) {
            return {
                borderColor: color === undefined ? '' : color,
            };
        }
        if (color === undefined && this._hovered !== -1) {
            if (
                (row.position < this._hovered &&
                    position >= row.position &&
                    position <= this._hovered) ||
                (row.position > this._hovered &&
                    position <= row.position &&
                    position >= this._hovered)
            ) {
                return {
                    borderColor: scheme_color_accent,
                    borderWidth: '2px',
                };
            }
        }
        return {
            borderColor: color === undefined ? '' : color,
        };
    }

    public _ng_getRangeColor(): string | undefined {
        const position = this._getPosition();
        if (position === undefined) {
            return undefined;
        }
        return this.api.getTimestamp().getRangeColorFor(position);
    }

    public _ng_getTooltipStyle() {
        return this._ng_tooltip === undefined
            ? {}
            : {
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
                self._ng_bookmarked =
                    self._getPosition() === bookmark.position ? true : self._ng_bookmarked;
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
                if (
                    self._ng_tooltip === undefined &&
                    self.api.getTimestamp().getOpenRow() === undefined
                ) {
                    return;
                }
                self._ng_tooltip = undefined;
                self._forceUpdate();
            },
            resize(scope: ControllerSessionScope): void {
                const info: IRowNumberWidthData | undefined = scope.get(
                    ControllerSessionScope.Keys.CRowNumberWidth,
                );
                if (info === undefined) {
                    return;
                }
                if (info.checked) {
                    return;
                }
                scope.set<any>(
                    ControllerSessionScope.Keys.CRowNumberWidth,
                    {
                        checked: true,
                    },
                    false,
                );
                self._checkNumberNodeWidth(true);
            },
            setRank(rank: number): void {
                self._ng_number_filler = self._getNumberFiller();
                self._forceUpdate();
                self._checkNumberNodeWidth();
            },
        };
    }

    private _getPosition(): number | undefined {
        if (this.parent === EParent.output) {
            return this.position;
        } else if (this.parent === EParent.search) {
            return this.positionInStream;
        } else {
            return undefined;
        }
    }

    private _render() {
        const position = this._getPosition();
        if (position === undefined) {
            return;
        }
        if (this.pluginId === -1 || this.pluginId === undefined) {
            return;
        }
        this._ng_render = ERenderType.standard;
        this._ng_component = undefined;
        this._ng_render_api = undefined;
        this._ng_sourceColor = SourcesService.getSourceColor(this.pluginId);
        this._ng_number = position.toString();
        this._ng_number_filler = this._getNumberFiller();
        const render: Toolkit.ATypedRowRender<any> | undefined =
            OutputParsersService.getTypedRowRender(
                this._ng_sourceName === undefined ? '' : this._ng_sourceName,
                this._sourceMeta,
            );
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
                    inputs: (render.getAPI() as Toolkit.ATypedRowRenderAPIExternal).getInputs(),
                };
                break;
        }
        // Update render component
        this._updateRenderComp();
    }

    private _pending() {
        const position = this._getPosition();
        if (position === undefined) {
            return;
        }
        this._ng_number = position.toString();
        this._ng_number_filler = this._getNumberFiller();
        this._ng_component = undefined;
    }

    private _getNumberFiller(): string {
        if (this._ng_number === undefined) {
            return '';
        }
        const rank = this.api.getRank() - this._ng_number.length;
        return '0'.repeat(rank < 0 ? 0 : rank);
    }

    private _updateRenderComp() {
        const position = this._getPosition();
        if (
            this.rendercomp === undefined ||
            this.rendercomp === null ||
            this.sessionId === undefined ||
            this.str === undefined ||
            this.pluginId === undefined ||
            position === undefined
        ) {
            return;
        }
        this.rendercomp.update({
            str: this.str,
            sessionId: this.sessionId,
            pluginId: this.pluginId,
            position: position,
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
        const info: IRowNumberWidthData | undefined = this.api
            .getScope()
            .get(ControllerSessionScope.Keys.CRowNumberWidth);
        if (info === undefined) {
            return;
        }
        if (info.rank === this.api.getRank() && info.width !== 0 && !force) {
            return;
        }
        const size: ClientRect = (
            this.numbernode.nativeElement as HTMLElement
        ).getBoundingClientRect();
        if (size.width === 0 || info.width === size.width) {
            return;
        }
        this.api.getScope().set<any>(
            ControllerSessionScope.Keys.CRowNumberWidth,
            {
                rank: this.api.getRank(),
                width: size.width,
            },
            false,
        );
        info.onChanged.next();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
