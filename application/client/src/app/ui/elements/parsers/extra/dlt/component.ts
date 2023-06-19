import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { bytesToStr, timestampToUTC } from '@env/str';
import { State } from './state';
import { Observe } from '@platform/types/observe';

@Component({
    selector: 'app-el-dlt-extra',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class DltExtraConfiguration extends ChangesDetector implements AfterContentInit {
    @Input() observe!: Observe;

    protected state!: State;

    public bytesToStr = bytesToStr;
    public timestampToUTC = timestampToUTC;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.observe);
        this.state.bind(this);
        this.state.struct().load();
    }

    public ngOnEntitySelect() {
        this.state.buildSummary().selected();
        this.detectChanges();
    }

    public ngContextMenu(event: MouseEvent) {
        const after = () => {
            this.state.buildSummary().selected();
            this.detectChanges();
        };
        this.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: 'Select all',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.select());
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect all',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.unselect());
                        });
                        after();
                    },
                },
                {
                    caption: 'Reverse selection',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.toggle());
                        });
                        after();
                    },
                },
                {},
                {
                    caption: 'Select with fotal',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_fatal > 0 && e.select();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with errors',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_error > 0 && e.select();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with warnings',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_warning > 0 && e.select();
                            });
                        });
                        after();
                    },
                },
                {},
                {
                    caption: 'Unselect without fotal',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_fatal === 0 && e.unselect();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without errors',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_error === 0 && e.unselect();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without warnings',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_warning === 0 && e.unselect();
                            });
                        });
                        after();
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }
}
export interface DltExtraConfiguration extends IlcInterface {}
