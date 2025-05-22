import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { bytesToStr, timestampToUTC } from '@env/str';
import { State } from './state';
import { Element, NestedDictionaryElement } from '../../element';

import * as els from '../../element';

@Component({
    selector: 'app-settings-scheme-nested-dictionary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class NestedDictionary extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;
    @Input() inner!: NestedDictionaryElement<unknown>;

    protected state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.inner.items, this.inner.dictionary);
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
                            // section.entities.forEach((e) => {
                            //     e.log_fatal > 0 && e.select();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with errors',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_error > 0 && e.select();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with warnings',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_warning > 0 && e.select();
                            // });
                        });
                        after();
                    },
                },
                {},
                {
                    caption: 'Unselect without fotal',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_fatal === 0 && e.unselect();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without errors',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_error === 0 && e.unselect();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without warnings',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_warning === 0 && e.unselect();
                            // });
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
export interface NestedDictionary extends IlcInterface {}
