import {
    Component,
    AfterViewInit,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    ViewEncapsulation,
    Input,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Item } from './item';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State, CloseHandler } from './state';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { InputFilter } from '@elements/filter/component';

@Component({
    selector: 'app-favorites-mini',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class Favorites
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @ViewChild('filter') public filterInputRef!: InputFilter;
    @Input() close: CloseHandler | undefined;

    public readonly state: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
        this.state = new State(this);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.close !== undefined && this.state.bind(this.close);
    }

    public ngAfterViewInit(): void {
        this.bindFilterInput();
        this.env().subscriber.register(
            this.state.update.subscribe(() => {
                this.bindFilterInput();
                this.markChangesForCheck();
            }),
        );
    }

    public ngItemContextMenu(event: MouseEvent, item: Item) {
        this.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: 'Open as text',
                    handler: () => {
                        this.state.open(item).text();
                    },
                },
                {
                    caption: 'Open as DLT',
                    handler: () => {
                        this.state.open(item).dlt();
                    },
                },
                {
                    caption: 'Open as PCAP',
                    handler: () => {
                        this.state.open(item).pcap();
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }

    public ngOpen(item: Item): void {
        this.state.open(item).auto();
    }

    public addFolder(): void {
        this.state
            .selectAndAdd()
            .then(() => {
                this.state
                    .load()
                    .catch((err: Error) => {
                        this.log().error(`Fail to reload state favorites: ${err.message}`);
                    })
                    .finally(() => {
                        this.detectChanges();
                    });
            })
            .catch((err: Error) => {
                this.log().error(`Fail to add favorites: ${err.message}`);
            });
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public bindFilterInput() {
        this.detectChanges();
        this.filterInputRef !== undefined &&
            this.state.filter.bind(this.filterInputRef.getInputElementRef()).focus();
    }
}
export interface Favorites extends IlcInterface {}
