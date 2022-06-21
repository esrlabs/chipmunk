import { Component, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Initial } from '@env/decorators/initial';

import * as Scheme from './scheme';

@Component({
    selector: 'app-elements-tree',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ElementsTreeSelector extends ChangesDetector implements AfterContentInit {
    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state.init(this.ilc().services, this.log());
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    // constructor(database: DynamicDatabase) {
    //     this.treeControl = new FlatTreeControl<DynamicFlatNode>(this.getLevel, this.isExpandable);
    //     this.dataSource = new DynamicDataSource(this.treeControl, database);

    //     this.dataSource.data = database.initialData();
    // }

    public hasChild(_: number, _nodeData: Scheme.DynamicFlatNode): boolean {
        return _nodeData.expandable;
    }

    public ngItemContextMenu(event: MouseEvent, entity: Scheme.Entity) {
        if (entity.isFolder()) {
            return;
        }
        this.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: 'Open as text',
                    handler: () => {
                        this.ilc()
                            .services.system.opener.file(entity.getPath())
                            .text()
                            .catch((err: Error) => {
                                this.log().error(`Fail to open text file; error: ${err.message}`);
                            });
                    },
                },
                {
                    caption: 'Open as DLT',
                    handler: () => {
                        console.log(`Not implemented`);
                    },
                },
                {
                    caption: 'Open as PCAP',
                    handler: () => {
                        console.log(`Not implemented`);
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }
}
export interface ElementsTreeSelector extends IlcInterface {}
