import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ControllerSessionTabStreamOutput } from '../../../../controller/controller.session.tab.stream.output';
import { ControllerSessionTabSourcesState } from '../../../../controller/controller.session.tab.sources.state';
import { ControllerSessionTabStreamBookmarks, IBookmark } from '../../../../controller/controller.session.tab.stream.bookmarks';
import { ControllerSessionScope } from '../../../../controller/controller.session.tab.scope';
import SourcesService from '../../../../services/service.sources';
import OutputParsersService, { ITypedRowComponent } from '../../../../services/standalone/service.output.parsers';
import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';
import { IComponentDesc } from 'logviewer-client-containers';
import { AOutputRenderComponent } from '../../../../interfaces/interface.output.render';

enum ERenderType {
    standard = 'standard',
    external = 'external',
    columns = 'columns',
}

export interface IScope { [key: string]: any; }

export interface IRowNumberWidthData {
    rank: number;
    width: number;
}

export const CRowNumberWidthKey = 'row-number-width-key';

@Component({
    selector: 'app-views-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    // encapsulation: ViewEncapsulation.None
})

export class ViewOutputRowComponent implements AfterContentInit, AfterContentChecked, OnDestroy, AfterViewInit {

    @ViewChild('rendercomp') rendercomp: AOutputRenderComponent;
    @ViewChild('numbernode') numbernode: ElementRef;

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public controller: ControllerSessionTabStreamOutput | undefined;
    @Input() public bookmarks: ControllerSessionTabStreamBookmarks | undefined;
    @Input() public sources: ControllerSessionTabSourcesState | undefined;
    @Input() public scope: ControllerSessionScope | undefined;
    @Input() public rank: number = 1;

    public _ng_sourceName: string | undefined;
    public _ng_number: string | undefined;
    public _ng_number_filler: string | undefined;
    public _ng_bookmarked: boolean = false;
    public _ng_sourceColor: string | undefined;
    public _ng_source: boolean = false;
    public _ng_component: IComponentDesc | undefined;
    public _ng_render: ERenderType = ERenderType.standard;
    public _ng_render_api: any;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _subjects: {
        update: Subject<{ [key: string]: any }>
    } = {
        update: new Subject<{ [key: string]: any }>()
    };

    constructor(private _cdRef: ChangeDetectorRef ) {
        this._onRankChanged = this._onRankChanged.bind(this);
        this._subscriptions.onUpdatedSearch = OutputParsersService.getObservable().onUpdatedSearch.subscribe(this._onUpdatedSearch.bind(this));
        this._subscriptions.onRepain = OutputParsersService.getObservable().onRepain.subscribe(this._onRepain.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._subjects).forEach((key: string) => {
            this._subjects[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public ngAfterContentInit() {
        if (this.controller === undefined) {
            return;
        }
        if (this._subscriptions.onRankChanged !== undefined) {
            return;
        }
        this._ng_source = this.sources.isVisible();
        this._subscriptions.onRankChanged = this.controller.getObservable().onRankChanged.subscribe(this._onRankChanged);
        this._subscriptions.onAddedBookmark = this.bookmarks.getObservable().onAdded.subscribe(this._onAddedBookmark.bind(this));
        this._subscriptions.onRemovedBookmark = this.bookmarks.getObservable().onRemoved.subscribe(this._onRemovedBookmark.bind(this));
        this._subscriptions.onSourceChange = this.sources.getObservable().onChanged.subscribe(this._onSourceChange.bind(this));
    }

    public ngAfterContentChecked() {
        if (this.position.toString() === this._ng_number) {
            return;
        }
        this._ng_bookmarked = this.bookmarks.isBookmarked(this.position);
        if (this.str === undefined) {
            this._pending();
        } else {
            this._render();
        }
    }

    public ngAfterViewInit() {
        this._checkNumberNodeWidth();
    }

    public _ng_onToggleSource() {
        this.sources.change(!this._ng_source);
    }

    public _ng_isPending() {
        return this.str === undefined;
    }

    public _ng_onRowSelect() {
        OutputRedirectionsService.select('stream', this.sessionId, this.position);
    }

    public _ng_onNumberClick() {
        if (this.bookmarks === undefined) {
            return;
        }
        if (this.bookmarks.isBookmarked(this.position)) {
            this.bookmarks.remove(this.position);
            this._ng_bookmarked = false;
        } else {
            this.bookmarks.add({
                str: this.str,
                position: this.position,
                pluginId: this.pluginId,
                rank: this.rank,
            });
            this._ng_bookmarked = true;
        }
        if (!this._destroyed) {
            this._cdRef.detectChanges();
        }
    }

    private _onAddedBookmark(bookmark: IBookmark) {
        const prev: boolean = this._ng_bookmarked;
        this._ng_bookmarked = this.position === bookmark.position ? true : this._ng_bookmarked;
        if (prev !== this._ng_bookmarked) {
            this._cdRef.detectChanges();
        }
    }

    private _onRemovedBookmark(index: number) {
        const prev: boolean = this._ng_bookmarked;
        this._ng_bookmarked = this.position === index ? false : this._ng_bookmarked;
        if (prev !== this._ng_bookmarked) {
            this._cdRef.detectChanges();
        }
    }

    private _render() {
        if (this.pluginId === -1) {
            return;
        }
        this._ng_render = ERenderType.standard;
        this._ng_component = undefined;
        this._ng_render_api = undefined;
        const sourceName: string = SourcesService.getSourceName(this.pluginId);
        this._ng_sourceColor = SourcesService.getSourceColor(this.pluginId);
        if (sourceName === undefined) {
            this._ng_sourceName = 'n/d';
        } else {
            this._ng_sourceName = sourceName;
        }
        this._ng_number = this.position.toString();
        this._ng_number_filler = this._getNumberFiller();
        // Check for external render
        this._ng_component = OutputParsersService.getRowComponent(sourceName);
        if (this._ng_component !== undefined) {
            this._ng_render = ERenderType.external;
            // Update render component
            this._updateRenderComp();
            // No need to check other types
            return;
        }
        // Check custom render
        const custom = OutputParsersService.getCustomRowRender(sourceName);
        if (custom !== undefined) {
            switch (custom.type) {
                case ERenderType.columns:
                    this._ng_render = ERenderType.columns;
                    this._ng_render_api = custom.api;
                    break;
            }
        }
        // Update render component
        this._updateRenderComp();
    }

    private _pending() {
        this._ng_number = this.position.toString();
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

    private _onUpdatedSearch() {
        if (this.str === undefined) {
            return;
        }
        this._render();
        this._cdRef.detectChanges();
    }

    private _onRepain() {
        if (this.str === undefined) {
            return;
        }
        this._render();
        this._cdRef.detectChanges();
    }

    private _onRankChanged(rank: number) {
        this.rank = rank;
        this._ng_number_filler = this._getNumberFiller();
        this._cdRef.detectChanges();
        this._checkNumberNodeWidth();
    }

    private _onSourceChange(source: boolean) {
        this._ng_source = source;
        this._cdRef.detectChanges();
    }

    private _updateRenderComp() {
        if (this.rendercomp === undefined || this.rendercomp === null) {
            return;
        }
        this.rendercomp.update({
            str: this.str,
            sessionId: this.sessionId,
            pluginId: this.pluginId,
            position: this.position,
            scope: this.scope,
            output: this.controller,
        });
    }

    private _checkNumberNodeWidth() {
        if (this.numbernode === undefined) {
            return;
        }
        if (this.scope === undefined) {
            return;
        }
        const info: IRowNumberWidthData | undefined = this.scope.get(CRowNumberWidthKey);
        if (info === undefined || info.rank !== this.rank) {
            const size: ClientRect = (this.numbernode.nativeElement as HTMLElement).getBoundingClientRect();
            if (size.width === 0) {
                return;
            }
            if (info !== undefined && (info.width - 21.1) >= size.width) {
                // Node isn't updated yet
                return;
            }
            this.scope.set(CRowNumberWidthKey, {
                rank: this.rank,
                width: size.width + 21.1
            });
        }
    }

}
