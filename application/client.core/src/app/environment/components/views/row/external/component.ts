import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import SourcesService from '../../../../services/service.sources';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';
import { AOutputRenderComponent, IOutputRenderInputs } from '../../../../interfaces/interface.output.render';
import { IComponentDesc } from 'logviewer-client-containers';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import { Subscription, Subject } from 'rxjs';
import { ControllerSessionScope } from '../../../../controller/controller.session.tab.scope';

@Component({
    selector: 'app-views-output-row-external',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    // encapsulation: ViewEncapsulation.None
})

export class ViewOutputRowExternalComponent extends AOutputRenderComponent implements AfterContentInit, AfterContentChecked, OnDestroy {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public source: string | undefined;
    @Input() public component: IComponentDesc | undefined;
    @Input() public scope: ControllerSessionScope | undefined;

    private _subjects: {
        update: Subject<{ [key: string]: any }>
    } = {
        update: new Subject<{ [key: string]: any }>()
    };

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef ) {
        super();
    }

    @HostBinding('class') classes = 'row noreset';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';

    public ngOnDestroy() {
    }

    public ngAfterContentInit() {
        this._render();
    }

    public ngAfterContentChecked() {

    }

    public update(inputs: IOutputRenderInputs): void {
        Object.keys(inputs).forEach((key: string) => {
            (this as any)[key] = inputs[key];
        });
        this._subjects.update.next({
            str: this.str,
            html: this._getHTML(this.str),
        });
    }

    private _render() {
        if (this.pluginId === -1) {
            return;
        }
        if (this.component === undefined) {
            return;
        }
        // Define inputs for custom render
        const inputs = Object.assign(this.component.inputs, {
            str: this.str,
            html: this._getHTML(this.str),
            api: TabsSessionsService.getPluginAPI(this.pluginId),
            update: this._subjects.update
        });
        this.component.inputs = inputs;
    }

    private _getHTML(str: string): string {
        // Rid of HTML
        str = OutputParsersService.serialize(str);
        // Apply plugin parser
        str = OutputParsersService.row(str, this.pluginId, this.source, this.position);
        // Apply search matches parser
        const matches = OutputParsersService.matches(this.sessionId, this.position, str);
        // Set colors
        this.color = matches.color;
        this.background = matches.background;
        // Apply colors for sources (if more than 1)
        const countOfSessionSources: number = SourcesService.getCountOfSource(this.sessionId);
        if (this.background === undefined && countOfSessionSources > 1) {
            this.background = SourcesService.getSourceShadowColor(this.pluginId);
        }
        // Return parsed HTML
        return matches.str;
    }

}
