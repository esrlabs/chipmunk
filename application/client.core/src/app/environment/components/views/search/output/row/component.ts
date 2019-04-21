import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import SourcesService from '../../../../../services/service.sources';
import OutputParsersService from '../../../../../services/standalone/service.output.parsers';
import OutputRedirectionsService from '../../../../../services/standalone/service.output.redirections';

@Component({
    selector: 'app-views-search-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewSearchOutputRowComponent implements AfterContentChecked, OnDestroy {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public positionInStream: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public rank: number = 1;

    public _ng_safeHtml: SafeHtml = null;
    public _ng_sourceName: string | undefined;
    public _ng_number: string | undefined;
    public _ng_number_filler: string | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef ) {
        this._onUpdatedSearch = this._onUpdatedSearch.bind(this);
        this._subscriptions.onUpdatedSearch = OutputParsersService.getObservable().onUpdatedSearch.subscribe(this._onUpdatedSearch);
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentChecked() {
        if (this.positionInStream.toString() === this._ng_number) {
            return;
        }
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
        OutputRedirectionsService.select('search', this.sessionId, this.positionInStream);
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
        html = OutputParsersService.matches(this.sessionId, this.positionInStream, html);
        // Generate safe html
        this._ng_safeHtml = this._sanitizer.bypassSecurityTrustHtml(html);
        this._ng_number = this.positionInStream.toString();
        this._ng_number_filler = this._getNumberFiller();
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

}
