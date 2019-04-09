import { Component, Input, AfterContentChecked } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IStreamPacket } from '../../../../controller/controller.session.tab.stream.output';
import PluginsService, { IPluginData } from '../../../../services/service.plugins';

@Component({
    selector: 'app-views-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputRowComponent implements AfterContentChecked {

    @Input() public str: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;

    public _ng_safeHtml: SafeHtml = null;
    public _ng_sourceName: string | undefined;
    public _ng_number: string | undefined;

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

    private _acceptRowWithContent() {
        if (this.pluginId === -1) {
            return;
        }
        const plugin: IPluginData | undefined = PluginsService.getPluginById(this.pluginId);
        let html = this.str;
        if (plugin === undefined) {
            this._ng_sourceName = 'n/d';
        } else {
            this._ng_sourceName = plugin.name;
            if (plugin.parsers.row !== undefined) {
                html = plugin.parsers.row(html);
            }
        }
        this._ng_safeHtml = this._sanitizer.bypassSecurityTrustHtml(html);
        this._ng_number = this.position.toString();
    }

    private _acceptPendingRow() {
        this._ng_number = this.position.toString();
    }

}
