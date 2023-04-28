import { Component, Input, HostListener, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Attachment } from '@platform/types/content';
import { bytesToStr } from '@env/str';

@Component({
    selector: 'app-views-attachments-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Item implements AfterContentInit {
    @Input() attachment!: Attachment;

    public ext!: string;
    public size!: string;

    @HostListener('contextmenu', ['$event']) async onContextMenu(_event: MouseEvent) {
        // const items = this.element.provider.contextMenu(this.element.source);
        // if (items.length > 0) {
        //     items.push({});
        // }
        // items.push({
        //     caption: 'Reopen in New Tab',
        //     handler: () => {
        //         this.element.provider.openAsNew(this.element.source).catch((err: Error) => {
        //             this.log().error(`Fail to open Source: ${err.message}`);
        //         });
        //     },
        // });
        // this.ilc().emitter.ui.contextmenu.open({
        //     items,
        //     x: event.x,
        //     y: event.y,
        // });
    }

    public ngAfterContentInit(): void {
        this.ext = this.attachment.extAsString();
        this.size = bytesToStr(this.attachment.size);
    }
}
export interface Item extends IlcInterface {}
