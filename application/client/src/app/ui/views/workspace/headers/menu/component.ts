import {
    AfterContentInit,
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
} from '@angular/core';
import { ComColorSelectorComponent } from '@ui/elements/color.selector/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { CColors, scheme_color_accent } from '@ui/styles/colors';

@Component({
    selector: 'app-scrollarea-rows-columns-headers-context-menu',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewWorkspaceHeadersMenuComponent
    extends ChangesDetector
    implements OnDestroy, AfterContentInit, AfterViewInit {
        // public _ng_columns: IColumn[] = [];
        public _ng_selected: number | undefined = undefined;
        public colors: string[] = [];
        public color: string = scheme_color_accent;

        constructor(cdRef: ChangeDetectorRef) {
            super(cdRef);
        }

        public ngOnDestroy(): void {

        }

        public ngAfterContentInit(): void {
            this._init();
            debugger
        }

        public ngAfterViewInit(): void {

        }

        private _init() {
            this._setColors();
        }

        private _setColors() {
            this.colors = [...CColors];
            this.detectChanges();
        }

}
