import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService, TabsOptions, ETabsListDirection, DockingComponent, DockDef, DocksService } from 'logviewer-client-complex';
import { AreaState } from '../state';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-layout-area-primary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimaryAreaComponent implements AfterViewInit, OnDestroy {

    @Input() public state: AreaState;

    public tabsService: TabsService = new TabsService();

    private _subscriptions: {
        minimized: Subscription | null,
        updated: Subscription | null,
    } = {
        minimized: null,
        updated: null,
    };

    constructor(private _cdRef: ChangeDetectorRef) {
        (window as any).__tabs = this.tabsService;
        this.tabsService.add({
            name: 'Tab 1 (3)',
            active: true,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 2' }),
                            b: new DockDef.Dock({ caption: 'Dock 3' })
                        })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 2 (2)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' }),
                        b: new DockDef.Dock({ caption: 'Dock 2' })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 3 (4)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '1' }),
                            b: new DockDef.Dock({ caption: '2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '3' }),
                            b: new DockDef.Dock({ caption: '4' })
                        })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 4 (5)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 1' }),
                            b: new DockDef.Dock({ caption: 'Dock 2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 3' }),
                            b: new DockDef.Container({
                                a: new DockDef.Dock({ caption: 'Dock 4' }),
                                b: new DockDef.Dock({ caption: 'Dock 5' })
                            })
                        })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 5',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' })
                    }))
                }
            }
        });
    }

    ngAfterViewInit() {
        if (!(this.state)) {
            return;
        }
        this._subscriptions.minimized = this.state.getObservable().minimized.subscribe(this._onMinimized.bind(this));
        this._subscriptions.updated = this.state.getObservable().updated.subscribe(this._onUpdated.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    public _onTabsAreaClick() {
        if (!this.state.minimized) {
            return;
        }
        this.state.maximize();
        console.log('dfsdfsdsfsdfsd');
    }

    private _onMinimized(minimized: boolean) {
        this._cdRef.detectChanges();
    }

    private _onUpdated(state: AreaState) {
        this._cdRef.detectChanges();
    }
}
