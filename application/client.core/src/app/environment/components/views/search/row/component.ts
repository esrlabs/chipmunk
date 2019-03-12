import { Component, Input, AfterContentChecked } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ISearchPacket } from '../../../../controller/controller.session.tab.search.output';
import PluginsService, { IPluginData } from '../../../../services/service.plugins';

@Component({
    selector: 'app-views-search-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewSearchRowComponent implements AfterContentChecked {
    @Input() public row: ISearchPacket | undefined;

    public _ng_safeHtml: SafeHtml = null;
    public _ng_sourceName: string | undefined;

    constructor(private _sanitizer: DomSanitizer) {
    }

    ngAfterContentChecked() {
        if (this.row.pluginId === -1) {
            return;
        }
        const plugin: IPluginData | undefined = PluginsService.getPluginById(this.row.pluginId);
        let html = this.row.original;
        if (plugin === undefined) {
            this._ng_sourceName = 'n/d';
        } else {
            this._ng_sourceName = plugin.name;
            if (plugin.parsers.row !== undefined) {
                html = plugin.parsers.row(html);
            }
        }
        this._ng_safeHtml = this._sanitizer.bypassSecurityTrustHtml(html);
    }

}
