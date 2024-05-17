import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    AfterContentInit,
    ViewEncapsulation,
    ViewChild,
    ElementRef,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Initial } from '@env/decorators/initial';
import { stop } from '@ui/env/dom';

import * as Scheme from './scheme';
import * as Factory from '@platform/types/observe/factory';

@Component({
    selector: 'app-elements-tree',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class ElementsTreeSelector
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit
{
    @ViewChild('container') container!: ElementRef<HTMLElement>;

    public state: State;
    private init!: Promise<void>;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
        this.state = new State(this);
    }

    public ngAfterContentInit(): void {
        this.init = this.state.init(this.ilc().services).catch((err: Error) => {
            this.log().error(`Fail to init folder's tree state: ${err.message}`);
        });
    }

    public ngAfterViewInit(): void {
        this.state.bind(this.container.nativeElement);
        this.init.then(() => {
            this.state.expand();
        });
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public hasChild(_: number, _nodeData: Scheme.DynamicFlatNode): boolean {
        return _nodeData.expandable;
    }

    public ngItemContextMenu(event: MouseEvent, entity: Scheme.Entity) {
        if (entity.favourite) {
            this.ilc().emitter.ui.contextmenu.open({
                items: [
                    {
                        caption: 'Delete from favourites',
                        handler: () => {
                            this.state.removePlace(entity);
                            this.detectChanges();
                        },
                    },
                ],
                x: event.x,
                y: event.y,
            });
            return;
        }
        if (entity.isFolder()) {
            this.ilc().emitter.ui.contextmenu.open({
                items: [
                    {
                        caption: 'Add to favourites',
                        handler: () => {
                            this.ilc()
                                .services.system.favorites.places()
                                .add(entity.getPath())
                                .then(() => {
                                    this.detectChanges();
                                })
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to add place into favorites: ${err.message}`,
                                    );
                                });
                        },
                    },
                ],
                x: event.x,
                y: event.y,
            });
            return;
        }
        this.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: 'Open as text',
                    handler: () => {
                        this.ilc()
                            .services.system.session.initialize()
                            .observe(
                                new Factory.File()
                                    .type(Factory.FileType.Text)
                                    .asText()
                                    .file(entity.getPath())
                                    .get(),
                            )
                            .catch((err: Error) => {
                                this.log().error(`Fail to open text file; error: ${err.message}`);
                            });
                    },
                },
                {
                    caption: 'Open as DLT',
                    handler: () => {
                        this.ilc()
                            .services.system.session.initialize()
                            .observe(
                                new Factory.File()
                                    .asDlt()
                                    .type(Factory.FileType.Binary)
                                    .file(entity.getPath())
                                    .get(),
                            )
                            .catch((err: Error) => {
                                this.log().error(`Fail to open dlt file; error: ${err.message}`);
                            });
                    },
                },
                {
                    caption: 'Open as PcapNG',
                    handler: () => {
                        this.ilc()
                            .services.system.session.initialize()
                            .observe(
                                new Factory.File()
                                    .type(Factory.FileType.PcapNG)
                                    .asDlt()
                                    .file(entity.getPath())
                                    .get(),
                            )
                            .catch((err: Error) => {
                                this.log().error(`Fail to open pcapng file; error: ${err.message}`);
                            });
                    },
                },
                {
                    caption: 'Open as PcapN',
                    handler: () => {
                        this.ilc()
                            .services.system.session.initialize()
                            .observe(
                                new Factory.File()
                                    .type(Factory.FileType.PcapLegacy)
                                    .asDlt()
                                    .file(entity.getPath())
                                    .get(),
                            )
                            .catch((err: Error) => {
                                this.log().error(`Fail to open pcapng file; error: ${err.message}`);
                            });
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }

    public onDefaultAction(entity: Scheme.Entity) {
        if (entity.isFolder()) {
            return;
        }
        this.ilc()
            .services.system.session.initialize()
            .suggest(entity.getPath())
            .catch((err: Error) => {
                this.log().error(`Fail open file: ${entity.getPath()}: ${err.message}`);
            });
    }

    public onScrolling(event: Event) {
        stop(event as MouseEvent);
        return false;
    }

    public add() {
        this.ilc()
            .services.system.favorites.places()
            .selectAndAdd()
            .then(() => {
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to add place into favorites: ${err.message}`);
            });
    }

    public reload() {
        this.state
            .reload()
            .then(() => {
                this.detectChanges();
                this.state.expand();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to reload favorites places: ${err.message}`);
            });
    }
}
export interface ElementsTreeSelector extends IlcInterface {}
