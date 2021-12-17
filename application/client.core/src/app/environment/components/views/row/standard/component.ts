import {
    Component,
    Input,
    AfterContentChecked,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
    AOutputRenderComponent,
    IOutputRenderInputs,
} from '../../../../interfaces/interface.output.render';
import { EParent } from '../../../../services/standalone/service.output.redirections';
import { ControllerRowAPI } from '../../../../controller/session/dependencies/row/controller.row.api';

import OutputParsersService from '../../../../services/standalone/service.output.parsers';

@Component({
    selector: 'app-views-output-row-standard',
    styleUrls: ['./styles.less'],
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewOutputRowStandardComponent
    extends AOutputRenderComponent
    implements AfterContentInit, AfterContentChecked, OnDestroy
{
    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public source: string | undefined;
    @Input() public parent!: EParent;
    @Input() public api!: ControllerRowAPI;

    private _safeHtml: SafeHtml | null = null;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef) {
        super();
    }

    @HostBinding('class') classes = 'row noreset';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';
    @HostBinding('innerHTML') set html(str: string | SafeHtml) {
        if (this.pluginId === -1) {
            this._safeHtml = null;
            return;
        }
        if (this.sessionId === undefined || this.str === undefined) {
            return;
        }
        let html = this.str;
        // Apply search matches parser
        const highlight = OutputParsersService.highlight(this.sessionId, this.str, this.parent);
        this.color = highlight.color === undefined ? '' : highlight.color;
        this.background = highlight.background === undefined ? '' : highlight.background;
        // Rid of HTML
        html = OutputParsersService.serialize(html);
        // Apply plugin parser html, this.pluginId, this.source, this.position
        html = OutputParsersService.row(
            {
                str: html,
                pluginId: this.pluginId,
                source: this.source,
                position: this.position,
                hasOwnStyles: highlight.color !== undefined || highlight.background !== undefined,
            },
            this.parent,
        );
        // Generate html
        this._safeHtml = this._sanitizer.bypassSecurityTrustHtml(html);
    }

    get html() {
        return this._safeHtml === null ? '' : this._safeHtml;
    }

    public ngOnDestroy() {}

    public ngAfterContentInit() {
        if (this.str !== undefined) {
            this.html = this.str;
        }
    }

    public ngAfterContentChecked() {}

    public update(inputs: IOutputRenderInputs): void {
        if (this.str === undefined) {
            return;
        }
        Object.keys(inputs).forEach((key: string) => {
            (this as any)[key] = (inputs as any)[key];
        });
        this.html = this.str;
    }
}
