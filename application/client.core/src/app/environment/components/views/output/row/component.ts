import { Component, Input, AfterContentChecked, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import SourcesService from '../../../../services/service.sources';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';
import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';

@Component({
    selector: 'app-views-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    // encapsulation: ViewEncapsulation.None
})

export class ViewOutputRowComponent implements AfterContentChecked {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public rank: number = 1;

    public _ng_safeHtml: SafeHtml = null;
    public _ng_sourceName: string | undefined;
    public _ng_number: string | undefined;
    public _ng_number_filler: string | undefined;

    constructor(private _sanitizer: DomSanitizer) {
    }

    public ngAfterContentChecked() {
        if (this.position.toString() === this._ng_number) {
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
        OutputRedirectionsService.select('stream', this.sessionId, this.position);
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

}
