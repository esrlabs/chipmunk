import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
} from '@angular/core';
import { Columns } from '@schema/render/columns';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { CColors } from '@ui/styles/colors';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-scrollarea-rows-columns-headers-context-menu',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewWorkspaceHeadersMenuComponent extends ChangesDetector {
    public selectedColumn: number | undefined = undefined;
    public colors: string[] = CColors;

    @Input() public uuid!: string;
    @Input() public controller!: Columns;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnCheckboxClick(event: MouseEvent, uuid: string): void {
        stop(event);
        this.controller.toggleVisibility(uuid);
        this.detectChanges();
    }

    public ngOnColorClick(_event: MouseEvent, color: string): void {
        this.controller.setColor(this.uuid, color);
        this.detectChanges();
    }
}
