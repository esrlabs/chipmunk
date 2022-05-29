import {
    Component,
    OnDestroy,
    ViewChild,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    AfterViewInit,
    HostBinding,
    HostListener,
    ElementRef,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Providers } from './providers/providers';
import { Provider, ProviderData, ISelectEvent } from './providers/definitions/provider';
import { DragAndDropService } from './draganddrop/service';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ProviderFilters } from './filters/provider';
import { ProviderDisabled } from './disabled/provider';

@Component({
    selector: 'app-views-filters',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class Filters extends ChangesDetector implements OnDestroy, AfterContentInit, AfterViewInit {
    @Input() session!: Session;

    public _ng_providers: Provider<any>[] = [];
    public _ng_selected: Provider<any> | undefined;

    private _providers!: Providers;
    private _draganddrop!: DragAndDropService;
    private _focused: boolean = false;

    @HostBinding('attr.tabindex') get tabindex() {
        return 0;
    }
    @HostListener('focus', ['$event.target']) onFocus() {
        this._focused = true;
    }
    @HostListener('blur', ['$event.target']) onBlur() {
        this._focused = false;
    }
    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Clear recent history`,
                handler: () => {
                    // this._session
                    //         .getSessionSearch()
                    //         .getStoreAPI()
                    //         .clear()
                    //         .catch((error: Error) => {
                    //             this._notifications.add({
                    //                 caption: 'Error',
                    //                 message: `Fail to drop recent filters history due error: ${error.message}`,
                    //             });
                    //         });
                },
            },
        ];
        contextmenu.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
        this._onGlobalKeyUp = this._onGlobalKeyUp.bind(this);
    }

    public ngOnDestroy() {
        this._providers.destroy();
        window.removeEventListener('keyup', this._onGlobalKeyUp);
    }

    public ngAfterContentInit(): void {
        this._draganddrop = new DragAndDropService();
        this._providers = new Providers(this.session, this._draganddrop, this.log());
        this._providers.add(ProviderData.filters, ProviderFilters);
        this._providers.add(ProviderData.disabled, ProviderDisabled);
        this._ng_providers = this._providers.list();
        this.env().subscriber.register(
            this._providers.subjects.select.subscribe((event: ISelectEvent | undefined) => {
                if (event === undefined && this._ng_selected === undefined) {
                    return;
                }
                if (event === undefined) {
                    this._ng_selected = undefined;
                } else {
                    this._ng_selected = event.provider;
                }
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this._providers.subjects.context.subscribe((event) => {
                contextmenu.show({
                    items: event.items,
                    x: event.event.pageX,
                    y: event.event.pageY,
                });
                event.event.stopImmediatePropagation();
                event.event.preventDefault();
            }),
        );
        this.env().subscriber.register(
            this._providers.subjects.change.subscribe(() => {
                this.detectChanges();
            }),
        );
        window.addEventListener('keyup', this._onGlobalKeyUp);
    }

    public ngAfterViewInit() {}

    public _ng_onPanelClick() {
        this.detectChanges();
    }

    public _ng_onMouseOver() {
        this._draganddrop.onMouseOverGlobal();
    }

    private _onGlobalKeyUp(event: KeyboardEvent) {
        if (!this._focused) {
            return;
        }
        switch (event.code) {
            case 'ArrowUp':
                this._providers.select().prev();
                break;
            case 'ArrowDown':
                this._providers.select().next();
                break;
            case 'Enter':
                this._providers.edit().in();
                break;
        }
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
    }
}
export interface Filters extends IlcInterface {}
