import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    SimpleChange,
    AfterContentInit,
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
export class ViewWorkspaceHeadersMenuComponent extends ChangesDetector implements AfterContentInit {
    protected clickOnCheckbox: boolean = false;
    protected switch(index: number): void {
        this.index = index;
        const header = this.controller.get().byIndex(index);
        this.color = header === undefined ? undefined : header.color;
    }

    public colors: string[] = CColors.slice(1);
    public color: string | undefined;

    @Input() public index!: number;
    @Input() public controller!: Columns;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.switch(this.index);
    }

    public ngOnContainerClick(index: number): void {
        if (this.clickOnCheckbox) {
            this.clickOnCheckbox = false;
            return;
        }
        this.switch(index);
        this.detectChanges();
    }

    public ngOnCheckboxClick(): void {
        this.clickOnCheckbox = true;
    }

    public ngOnCheckboxChange(event: SimpleChange, index: number): void {
        this.controller.visibility(index).set(event as unknown as boolean);
        this.detectChanges();
    }

    public ngOnColorClick(color: string): void {
        this.controller.color(this.index).set(color);
        this.detectChanges();
    }

    public isColorSelected(color: string): boolean {
        return this.color === color;
    }

    public reset() {
        this.controller.reset();
    }
}
