import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from '../../../../controller/controller.session.tab.stream.output';
import { ControllerSessionTabStreamBookmarks, IBookmark } from '../../../../controller/controller.session.tab.stream.bookmarks';
import SourcesService from '../../../../services/service.sources';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';
import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';

@Component({
    selector: 'app-views-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    // encapsulation: ViewEncapsulation.None
})

export class ViewOutputRowComponent implements AfterContentInit, AfterContentChecked, OnDestroy {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public controller: ControllerSessionTabStreamOutput | undefined;
    @Input() public bookmarks: ControllerSessionTabStreamBookmarks | undefined;
    @Input() public rank: number = 1;

    public _ng_safeHtml: SafeHtml = null;
    public _ng_sourceName: string | undefined;
    public _ng_number: string | undefined;
    public _ng_number_filler: string | undefined;
    public _ng_bookmarked: boolean = false;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef ) {
        this._onRankChanged = this._onRankChanged.bind(this);
        this._onUpdatedSearch = this._onUpdatedSearch.bind(this);
        this._subscriptions.onUpdatedSearch = OutputParsersService.getObservable().onUpdatedSearch.subscribe(this._onUpdatedSearch);
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
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
        this._subscriptions.onRankChanged = this.controller.getObservable().onRankChanged.subscribe(this._onRankChanged);
        this._subscriptions.onAddedBookmark = this.bookmarks.getObservable().onAdded.subscribe(this._onAddedBookmark.bind(this));
        this._subscriptions.onRemovedBookmark = this.bookmarks.getObservable().onRemoved.subscribe(this._onRemovedBookmark.bind(this));
    }

    public ngAfterContentChecked() {
        if (this.position.toString() === this._ng_number) {
            return;
        }
        this._ng_bookmarked = this.bookmarks.isBookmarked(this.position);
        if (this.str === undefined) {
            this._acceptPendingRow();
        } else {
            this._acceptRowWithContent();
        }
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

    private _acceptRowWithContent() {
        if (this.pluginId === -1) {
            return;
        }
        let html = this.str;
        const sourceName: string = SourcesService.getSourceName(this.pluginId);
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
        html = OutputParsersService.matches(this.sessionId, this.position, html);
        // Generate safe html
        this._ng_safeHtml = this._sanitizer.bypassSecurityTrustHtml(html);
        this._ng_number = this.position.toString();
        this._ng_number_filler = this._getNumberFiller();
    }

    private _acceptPendingRow() {
        this._ng_number = this.position.toString();
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

    private _onRankChanged(rank: number) {
        this.rank = rank;
        this._ng_number_filler = this._getNumberFiller();
        this._cdRef.detectChanges();
    }

}
