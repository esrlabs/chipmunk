import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';
import { ControllerSessionScope } from '../../../../controller/controller.session.tab.scope';
import { AOutputRenderComponent, IOutputRenderInputs } from '../../../../interfaces/interface.output.render';
import { ControllerColumns, IColumn } from './controller.columns';
import { Subscription, Subject } from 'rxjs';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { ControllerSessionTabStreamOutput } from '../../../../controller/controller.session.tab.stream.output';
import * as Toolkit from 'chipmunk.client.toolkit';
import { ViewOutputRowColumnsHeadersComponent, CColumnsHeadersKey } from './headers/component';

interface IAPI {
    getHeaders(): string[];
    getColumns(str: string): string[];
    getDefaultWidths(): Array<{ width: number, min: number }>;
}

const CControllerColumnsKey = 'row.columns.service';

@Component({
    selector: 'app-views-output-row-columns',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    // encapsulation: ViewEncapsulation.None
})

export class ViewOutputRowColumnsComponent extends AOutputRenderComponent implements AfterContentInit, AfterContentChecked, OnDestroy {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public source: string | undefined;
    @Input() public api: IAPI | undefined;
    @Input() public scope: ControllerSessionScope | undefined;
    @Input() public output: ControllerSessionTabStreamOutput | undefined;

    public _ng_columns: Array<{ html: SafeHtml, index: number }> = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _columns: IColumn[] = [];

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef ) {
        super();
    }

    @HostBinding('class') classes = 'row noreset';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        const controller: ControllerColumns | undefined = this._getControllerColumns();
        if (controller === undefined) {
            return;
        }
        this._subscriptions.onResized = controller.getObservable().onResized.subscribe(this._onResized.bind(this));
        this._subscriptions.onUpdated = controller.getObservable().onUpdated.subscribe(this._onUpdated.bind(this));
        // Get widths
        this._columns = controller.getColumns();
        // Set headers
        this._headers();
        // Render
        this._render();
    }

    public ngAfterContentChecked() {

    }

    public update(inputs: IOutputRenderInputs): void {
        Object.keys(inputs).forEach((key: string) => {
            (this as any)[key] = inputs[key];
        });
        this._render();
    }

    public _ng_getStyles(key: number): { [key: string]: string } {
        return {
            width: `${this._columns[key].width}px`,
            color: this.color === undefined ? this._columns[key].color : this.color,
        };
    }

    private _render() {
        if (this.pluginId === -1) {
            this._ng_columns = [];
            return;
        }
        this.color = undefined;
        this.background = undefined;
        this._ng_columns = this.api.getColumns(this.str).map((column: string, index: number) => {
            if (!this._columns[index].visible) {
                return null;
            }
            // Rid of HTML
            column = OutputParsersService.serialize(column);
            // Apply search matches parser
            const matches = OutputParsersService.matches(this.sessionId, this.position, column);
            if (this.background === undefined || this.color === undefined) {
                this.color = matches.color;
                this.background = matches.background;
            }
            // Apply plugin parser
            column = OutputParsersService.row({
                str: column,
                pluginId: this.pluginId,
                source: this.source,
                position: this.position,
                hasOwnStyles: (matches.color !== undefined) || (matches.background !== undefined),
            });
            return {
                html: this._sanitizer.bypassSecurityTrustHtml(matches.str),
                index: index,
            };
        }).filter( i => i !== null );
    }

    private _getControllerColumns(): ControllerColumns | undefined {
        if (this.scope === undefined) {
            return undefined;
        }
        let controller: ControllerColumns | undefined = this.scope.get<ControllerColumns>(CControllerColumnsKey);
        if (!(controller instanceof ControllerColumns)) {
            controller = new ControllerColumns(
                this.api.getDefaultWidths(),
                this.api.getHeaders()
            );
            this.scope.set(CControllerColumnsKey, controller);
        }
        return controller as ControllerColumns;
    }

    private _onResized(columns: IColumn[]) {
        this._columns = columns;
        this._cdRef.detectChanges();
    }

    private _onUpdated(columns: IColumn[]) {
        this._columns = columns;
        this._render();
        this._cdRef.detectChanges();
    }

    private _headers() {
        const headerScopeValue: boolean | undefined = this.scope.get(CColumnsHeadersKey);
        const headersState: boolean = headerScopeValue === undefined ? false : headerScopeValue;
        if (headersState) {
            return;
        }
        const session: ControllerSessionTab = TabsSessionsService.getActive();
        session.addOutputInjection({
            factory: ViewOutputRowColumnsHeadersComponent,
            resolved: false,
            id: CColumnsHeadersKey,
            inputs: {
                controller: this._getControllerColumns(),
                scope: this.scope,
                output: this.output,
            }
        }, Toolkit.EViewsTypes.outputTop);
        this.scope.set(CColumnsHeadersKey, true);
    }

}
