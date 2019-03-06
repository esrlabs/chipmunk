import { Component, Input, AfterContentChecked } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-views-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputRowComponent implements AfterContentChecked {
    @Input() public row: string | undefined;

    public _ng_safeHtml: SafeHtml = null;

    constructor(private _sanitizer: DomSanitizer) {
    }

    ngAfterContentChecked() {
        this._ng_safeHtml = this._sanitizer.bypassSecurityTrustHtml(this.row);
    }

}
