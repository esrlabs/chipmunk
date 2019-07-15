import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import SourcesService from '../../../../../services/service.sources';
import OutputParsersService from '../../../../../services/standalone/service.output.parsers';
import { AOutputRenderComponent, IOutputRenderInputs } from '../../../../../interfaces/interface.output.render';
import { ControllerSessionScope } from '../../../../../controller/controller.session.tab.scope';

@Component({
    selector: 'app-views-output-row-standard',
    styleUrls: ['./styles.less'],
    template: '',
})

export class ViewOutputRowStandardComponent extends AOutputRenderComponent implements AfterContentInit, AfterContentChecked, OnDestroy {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public scope: ControllerSessionScope | undefined;

    private _safeHtml: SafeHtml = null;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef ) {
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
        let html = this.str;
        // Apply plugin parser
        html = OutputParsersService.row(html, this.pluginId);
        // Apply common parser
        html = OutputParsersService.row(html);
        // Apply search matches parser
        const matches = OutputParsersService.matches(this.sessionId, this.position, html);
        html = matches.str;
        this.color = matches.color;
        this.background = matches.background;
        // Apply colors for sources (if more than 1)
        const countOfSessionSources: number = SourcesService.getCountOfSource(this.sessionId);
        if (this.background === undefined && countOfSessionSources > 1) {
            this.background = SourcesService.getSourceShadowColor(this.pluginId);
        }
        // Generate html
        this._safeHtml = this._sanitizer.bypassSecurityTrustHtml(html);
    }

    get html() {
        return this._safeHtml;
    }

    public ngOnDestroy() {
    }

    public ngAfterContentInit() {
        this.html = this.str;
    }

    public ngAfterContentChecked() {

    }

    public update(inputs: IOutputRenderInputs): void {
        Object.keys(inputs).forEach((key: string) => {
            (this as any)[key] = inputs[key];
        });
        this.html = this.str;
    }

}
