import {
    Component,
    Input,
    AfterContentChecked,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ViewEncapsulation,
    ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
    AOutputRenderComponent,
    IOutputRenderInputs,
} from '../../../../interfaces/interface.output.render';
import { ControllerColumns, IColumn } from './controller.columns';
import { Subscription } from 'rxjs';
import { Session } from '../../../../controller/session/session';
import { ViewOutputRowColumnsHeadersComponent, CColumnsHeadersKey } from './headers/component';
import { EParent } from '../../../../services/standalone/service.output.redirections';
import { ControllerRowAPI } from '../../../../controller/session/dependencies/row/controller.row.api';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IAPI {
    getHeaders(): string[];
    getDelimiter(): string;
    getDefaultWidths(): Array<{ width: number; min: number }>;
}

const CControllerColumnsKey = 'row.columns.service';

@Component({
    selector: 'app-views-output-row-columns',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
export class ViewOutputRowColumnsComponent
    extends AOutputRenderComponent
    implements AfterContentInit, AfterContentChecked, OnDestroy
{
    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public source: string | undefined;
    @Input() public render: IAPI | undefined;
    @Input() public api!: ControllerRowAPI;
    @Input() public parent!: EParent;

    public _ng_columns: Array<{ html: SafeHtml; index: number }> = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _columns: IColumn[] = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewOutputRowColumnsComponent');
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef) {
        super();
    }

    @HostBinding('class') classes = 'row noreset';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        const controller: ControllerColumns | undefined = this._getControllerColumns();
        if (controller === undefined) {
            return;
        }
        this._subscriptions.onResized = controller
            .getObservable()
            .onResized.subscribe(this._onResized.bind(this));
        this._subscriptions.onUpdated = controller
            .getObservable()
            .onUpdated.subscribe(this._onUpdated.bind(this));
        // Get widths
        this._columns = controller.getColumns();
        // Render
        this._render();
        // Set headers
        this._headers();
    }

    public ngAfterContentChecked() {}

    public update(inputs: IOutputRenderInputs): void {
        Object.keys(inputs).forEach((key: string) => {
            (this as any)[key] = (inputs as any)[key];
        });
        this._render();
        this._forceUpdate();
    }

    public _ng_getStyles(key: number): { [key: string]: string } {
        const defColor =
            this.color === undefined
                ? (this._columns as any)[key].color
                : this.color === ''
                ? (this._columns as any)[key].color
                : this.color;
        return this._ng_isVisible(key)
            ? {
                  width: `${(this._columns as any)[key].width}px`,
                  color: defColor,
              }
            : {};
    }

    public _ng_isVisible(index: number): boolean {
        return this._columns[index] && this._columns[index].visible;
    }

    private _render() {
        if (this.sessionId === undefined || this.str === undefined) {
            return;
        }
        if (this.pluginId === -1) {
            this._ng_columns = [];
            return;
        }
        this.color = '';
        this.background = '';
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
        this._ng_columns = this._parse(html)
            //            .filter(c => this._columns[c.index] && this._columns[c.index].visible)
            .map((c) => ({
                html: this._sanitizer.bypassSecurityTrustHtml(c.html),
                index: c.index,
            }));
    }

    private _parse(html: string): Array<{ html: string; index: number }> {
        function getStrUntilChar(str: string): string | Error {
            const index: number = str.search('>');
            if (index === -1) {
                return new Error(`Fail to find closing symbol ">"`);
            }
            return str.substring(0, index + 1);
        }
        function getTagName(str: string): string | Error {
            const index: number = str.search(/[>\s]/gi);
            return index === -1
                ? new Error(`Fail to find closing tag symbol ">"`)
                : str.substring(0, index).replace(/[^\w\d_-]/gi, '');
        }
        if (this.render === undefined) {
            return [];
        }
        let chunk = '';
        const tags: Array<{ value: string; name: string }> = [];
        const columns: Array<{ html: string; index: number }> = [];
        const delimiter: string = this.render.getDelimiter();
        let cNum: number = 0;
        try {
            let pos: number = 0;
            do {
                if (['<', '>', delimiter].indexOf(html[pos]) !== -1) {
                    switch (html[pos]) {
                        case '<':
                            // Some tag is opened
                            if (pos + 1 > html.length) {
                                throw new Error(
                                    `Open/close tag symbol "<" has been found at the end of string`,
                                );
                            }
                            const tag: string | Error = getStrUntilChar(
                                html.substring(pos, html.length),
                            );
                            if (tag instanceof Error) {
                                throw tag;
                            }
                            if (tag[1] === '/') {
                                if (tags.length === 0) {
                                    throw new Error(`Found closing tag, but no opened tag`);
                                }
                                // Tag is closed
                                tags.splice(tags.length - 1, 1);
                            } else {
                                // Tag is opened
                                const tagName: string | Error = getTagName(tag);
                                if (tagName instanceof Error) {
                                    throw tagName;
                                }
                                tags.push({ value: tag, name: tagName });
                            }
                            pos += tag.length;
                            chunk += tag;
                            break;
                        case '>':
                            throw new Error(`">" has been found unexpectable`);
                        case delimiter:
                            chunk += tags.map((t) => `</${t.name}>`).join('');
                            chunk += delimiter;
                            columns.push({ html: chunk, index: cNum });
                            cNum += 1;
                            chunk = tags.map((t) => t.value).join('');
                            pos += 1;
                            break;
                    }
                } else {
                    chunk += html[pos];
                    pos += 1;
                }
            } while (pos < html.length);
            if (columns.length > 0) {
                columns.push({ html: chunk, index: cNum });
            }
        } catch (err) {
            this._logger.warn(
                `Fail to process columns row view due error: ${
                    err instanceof Error ? err.message : err
                }`,
            );
            return [];
        }
        return columns;
    }

    private _getControllerColumns(): ControllerColumns | undefined {
        if (this.api === undefined || this.render === undefined) {
            return undefined;
        }
        let controller: ControllerColumns | undefined = this.api
            .getScope()
            .get<ControllerColumns>(CControllerColumnsKey);
        if (!(controller instanceof ControllerColumns)) {
            controller = new ControllerColumns(
                this.render.getDefaultWidths(),
                this.render.getHeaders(),
            );
            this.api.getScope().set(CControllerColumnsKey, controller);
        }
        return controller as ControllerColumns;
    }

    private _onResized(columns: IColumn[]) {
        this._columns = columns;
        this._forceUpdate();
    }

    private _onUpdated(columns: IColumn[]) {
        this._columns = columns;
        this._render();
        this._forceUpdate();
    }

    private _headers() {
        const headerScopeValue: boolean | undefined = this.api.getScope().get(CColumnsHeadersKey);
        const headersState: boolean = headerScopeValue === undefined ? false : headerScopeValue;
        const session: Session | undefined = TabsSessionsService.getActive();
        if (headersState || session === undefined) {
            return;
        }
        session.addOutputInjection(
            {
                factory: ViewOutputRowColumnsHeadersComponent,
                resolved: false,
                id: CColumnsHeadersKey,
                inputs: {
                    controller: this._getControllerColumns(),
                    api: this.api,
                },
            },
            Toolkit.EViewsTypes.outputTop,
            true,
        );
        this.api.getScope().set(CColumnsHeadersKey, true);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
