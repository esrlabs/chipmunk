import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import SourcesService from '../../../../../services/service.sources';
import OutputParsersService from '../../../../../services/standalone/service.output.parsers';
import OutputRedirectionsService from '../../../../../services/standalone/service.output.redirections';
import { ControllerSessionTabStreamBookmarks, IBookmark } from '../../../../../controller/controller.session.tab.stream.bookmarks';
import { ControllerSessionTabSourcesState } from '../../../../../controller/controller.session.tab.sources.state';
import { IComponentDesc } from 'logviewer-client-containers';

@Component({
    selector: 'app-views-search-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewSearchOutputRowComponent implements AfterContentChecked, AfterContentInit, OnDestroy {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public positionInStream: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public rank: number = 1;
    @Input() public bookmarks: ControllerSessionTabStreamBookmarks | undefined;
    @Input() public sources: ControllerSessionTabSourcesState | undefined;

    public _ng_safeHtml: SafeHtml = null;
    public _ng_sourceName: string | undefined;
    public _ng_number: string | undefined;
    public _ng_number_filler: string | undefined;
    public _ng_bookmarked: boolean = false;
    public _ng_color: string | undefined;
    public _ng_background: string | undefined;
    public _ng_source: boolean = false;
    public _ng_sourceColor: string | undefined;
    public _ng_component: IComponentDesc | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef ) {
        this._subscriptions.onUpdatedSearch = OutputParsersService.getObservable().onUpdatedSearch.subscribe(this._onUpdatedSearch.bind(this));
        this._subscriptions.onRepain = OutputParsersService.getObservable().onRepain.subscribe(this._onRepain.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public ngAfterContentInit() {
        this._ng_source = this.sources.isVisible();
        this._subscriptions.onAddedBookmark = this.bookmarks.getObservable().onAdded.subscribe(this._onAddedBookmark.bind(this));
        this._subscriptions.onRemovedBookmark = this.bookmarks.getObservable().onRemoved.subscribe(this._onRemovedBookmark.bind(this));
        this._subscriptions.onSourceChange = this.sources.getObservable().onChanged.subscribe(this._onSourceChange.bind(this));
    }

    public ngAfterContentChecked() {
        if (this.positionInStream.toString() === this._ng_number) {
            return;
        }
        this._ng_bookmarked = this.bookmarks.isBookmarked(this.positionInStream);
        if (this.str === undefined) {
            this._acceptPendingRow();
        } else {
            this._acceptRowWithContent();
        }
    }

    public _ng_onToggleSource() {
        this.sources.change(!this._ng_source);
    }

    public _ng_isPending() {
        return this.str === undefined;
    }

    public _ng_onRowSelect() {
        OutputRedirectionsService.select('search', this.sessionId, this.positionInStream);
    }

    public _ng_onNumberClick() {
        if (this.bookmarks === undefined) {
            return;
        }
        if (this.bookmarks.isBookmarked(this.positionInStream)) {
            this.bookmarks.remove(this.positionInStream);
            this._ng_bookmarked = false;
        } else {
            this.bookmarks.add({
                str: this.str,
                position: this.positionInStream,
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
        this._ng_bookmarked = this.positionInStream === bookmark.position ? true : this._ng_bookmarked;
        if (prev !== this._ng_bookmarked) {
            this._cdRef.detectChanges();
        }
    }

    private _onRemovedBookmark(index: number) {
        const prev: boolean = this._ng_bookmarked;
        this._ng_bookmarked = this.positionInStream === index ? false : this._ng_bookmarked;
        if (prev !== this._ng_bookmarked) {
            this._cdRef.detectChanges();
        }
    }

    private _acceptRowWithContent() {
        if (this.pluginId === -1) {
            return;
        }
        let html = this.str;
        const sourceName: string = SourcesService.getSourceName(this.pluginId);
        this._ng_sourceColor = SourcesService.getSourceColor(this.pluginId);
        if (sourceName === undefined) {
            this._ng_sourceName = 'n/d';
        } else {
            this._ng_sourceName = sourceName;
        }
        // Apply plugin parser
        html = OutputParsersService.row(html, this.pluginId);
        // Apply common parser
        html = OutputParsersService.row(html);
        // Apply search matches parser
        const matches = OutputParsersService.matches(this.sessionId, this.positionInStream, html);
        html = matches.str;
        this._ng_color = matches.color;
        this._ng_background = matches.background;
        // Generate safe html
        this._ng_number = this.positionInStream.toString();
        this._ng_number_filler = this._getNumberFiller();
        // Check for external render
        const component: IComponentDesc | undefined = OutputParsersService.getRowComponent(sourceName);
        if (component === undefined) {
            // Generate safe html
            this._ng_safeHtml = this._sanitizer.bypassSecurityTrustHtml(html);
            this._ng_component = undefined;
        } else {
            component.inputs = Object.assign(component.inputs, {
                html: html
            });
            this._ng_component = component;
            this._ng_safeHtml = null;
        }
    }

    private _acceptPendingRow() {
        this._ng_number = this.positionInStream.toString();
        this._ng_number_filler = this._getNumberFiller();
    }

    private _getNumberFiller(): string {
        const rank = this.rank - this._ng_number.length;
        return '0'.repeat(rank < 0 ? 0 : rank);
    }

    private _onUpdatedSearch() {
        if (this.str === undefined) {
            return;
        }
        this._acceptRowWithContent();
        this._cdRef.detectChanges();
    }

    private _onRepain() {
        if (this.str === undefined) {
            return;
        }
        this._acceptRowWithContent();
        this._cdRef.detectChanges();
    }

    private _onSourceChange(source: boolean) {
        this._ng_source = source;
        this._cdRef.detectChanges();
    }

}
