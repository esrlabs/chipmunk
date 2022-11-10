import {
    Component,
    OnDestroy,
    ViewEncapsulation,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    HostBinding,
    HostListener,
    ElementRef,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Providers } from './providers/providers';
import { Provider, ProviderData, ISelectEvent } from './providers/definitions/provider';
import { DragAndDropService } from './draganddrop/service';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ProviderFilters } from './filters/provider';
import { ProviderDisabled } from './disabled/provider';

import * as dom from '@ui/env/dom';

@Component({
    selector: 'app-views-filters',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class Filters extends ChangesDetector implements OnDestroy, AfterContentInit {
    @Input() session!: Session;

    public providers: Provider<any>[] = [];
    public selected: Provider<any> | undefined;
    public draganddrop!: DragAndDropService;

    private _providers!: Providers;
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
        dom.stop(event);
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
        this.draganddrop = new DragAndDropService();
        this._providers = new Providers(this.session, this.draganddrop, this.log());
        this._providers.add(ProviderData.filters, ProviderFilters);
        this._providers.add(ProviderData.disabled, ProviderDisabled);
        this.providers = this._providers.list();
        this.env().subscriber.register(
            this._providers.subjects.select.subscribe((event: ISelectEvent | undefined) => {
                if (event === undefined && this.selected === undefined) {
                    return;
                }
                if (event === undefined) {
                    this.selected = undefined;
                } else {
                    this.selected = event.provider;
                }
                // this.detectChanges();
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

    public _ng_onPanelClick() {
        // this.detectChanges();
    }

    public _ng_onMouseOver() {
        this.draganddrop.onMouseOverGlobal();
    }

    public onShowPresets(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Open preset manager`,
                handler: () => {
                    //
                },
            },
        ];
        const session = this.ilc().services.system.history.get(this.session.uuid());
        const named = this.ilc().services.system.history.collections.find().named();
        if (named.length > 0 && session !== undefined) {
            const history = session;
            items.push({});
            named.forEach((col) => {
                items.push({
                    caption: col.name,
                    handler: () => {
                        history.apply(col);
                    },
                });
            });
        }
        contextmenu.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        dom.stop(event);
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
