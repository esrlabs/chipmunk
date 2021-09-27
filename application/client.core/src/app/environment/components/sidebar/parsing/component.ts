import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
    IUpdateEvent,
    ISelectionParser,
} from '../../../services/standalone/service.selection.parsers';
import { EParent } from '../../../services/standalone/service.output.redirections';

import SelectionParsersService from '../../../services/standalone/service.selection.parsers';
import OutputParsersService from '../../../services/standalone/service.output.parsers';
import ContextMenuService from '../../../services/standalone/service.contextmenu';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-parsing',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppParsingComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    @Input() public selection: string | undefined;
    @Input() public caption: string | undefined;
    @Input() public parsed: string | undefined;
    @Input() public getLastSelection!: () => IUpdateEvent | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppParsingComponent');

    public _ng_selection: SafeHtml | undefined;
    public _ng_caption: string | undefined;
    public _ng_parsed: SafeHtml | undefined;

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        this._subscriptions.onUpdate = SelectionParsersService.getObservable().onUpdate.subscribe(
            this._onUpdate.bind(this),
        );
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        const event: IUpdateEvent | undefined = this.getLastSelection();
        if (event !== undefined) {
            this.caption = event.caption;
            this.parsed = event.parsed;
            this.selection = event.selection;
        }
        if (this.selection === undefined) {
            return;
        }
        this._ng_caption = this.caption;
        this._ng_parsed = this.parsed === undefined ? undefined : this._getParsed(this.parsed);
        this._ng_selection = this._getSelection(this.selection);
        this._cdRef.detectChanges();
    }

    public ngAfterViewInit() {}

    public _ng_onContexMenu(event: MouseEvent) {
        const sel = document.getSelection();
        const selection: string = sel !== null ? sel.toString() : '';
        if (selection === '') {
            return;
        }
        const parsers: ISelectionParser[] = SelectionParsersService.getParsers(selection);
        if (parsers.length === 0) {
            return;
        }
        ContextMenuService.show({
            items: parsers.map((parser: ISelectionParser) => {
                return {
                    caption: parser.name,
                    handler: () => {
                        SelectionParsersService.parse(selection, parser.guid, parser.name);
                    },
                };
            }),
            x: event.pageX,
            y: event.pageY,
        });
    }

    private _onUpdate(event: IUpdateEvent) {
        this._ng_caption = event.caption;
        this._ng_parsed = event.parsed === undefined ? undefined : this._getParsed(event.parsed);
        this._ng_selection = this._getSelection(event.selection);
        this._cdRef.detectChanges();
    }

    private _getParsed(str: string): SafeHtml {
        // Add minimal HTML
        str = str.replace(/[\n\r]/gi, '<br/>');
        // Serialize
        str = OutputParsersService.serialize(str);
        // Apply plugin parser
        str = OutputParsersService.row({ str: str }, EParent.parsing);
        return this._sanitizer.bypassSecurityTrustHtml(str);
    }

    private _getSelection(str: string): SafeHtml {
        // Serialize
        str = OutputParsersService.serialize(str);
        // Apply plugin parser
        str = OutputParsersService.row(
            { str: str, source: 'details', hasOwnStyles: false },
            EParent.parsing,
        );
        return this._sanitizer.bypassSecurityTrustHtml(str);
    }
}
