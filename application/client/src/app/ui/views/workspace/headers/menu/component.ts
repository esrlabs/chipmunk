import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    SimpleChange,
} from '@angular/core';
import { Columns } from '@schema/render/columns';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { CColors } from '@ui/styles/colors';

@Component({
    selector: 'app-scrollarea-rows-columns-headers-context-menu',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewWorkspaceHeadersMenuComponent extends ChangesDetector {
    protected clickOnCheckbox: boolean = false;

    public selectedColumn: number | undefined = undefined;
    public colors: string[] = CColors;

    @Input() public uuid!: string;
    @Input() public controller!: Columns;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnContainerClick(event: MouseEvent, uuid: string): void {
        if (this.clickOnCheckbox) {
            this.clickOnCheckbox = false;
            return;
        }
        this.controller.toggleVisibility(uuid);
        this.detectChanges();
    }

    public ngOnCheckboxClick(): void {
        this.clickOnCheckbox = true;
    }

    public ngOnCheckboxChange(event: SimpleChange, uuid: string): void {
        this.controller.toggleVisibility(uuid, event as unknown as boolean);
        this.detectChanges();
    }

    public ngOnColorClick(_event: MouseEvent, color: string): void {
        this.controller.setColor(this.uuid, color);
        this.detectChanges();
    }
}
