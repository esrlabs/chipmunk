import {
    AfterContentInit,
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnChanges,
} from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { CColors } from '@ui/styles/colors';
import { Columns, Header } from '@schema/render/columns';

@Component({
    selector: 'app-scrollarea-rows-columns-headers-context-menu',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewWorkspaceHeadersMenuComponent
    extends ChangesDetector
    implements OnDestroy, OnChanges, AfterContentInit, AfterViewInit {
        // public _ng_columns: IColumn[] = [];
        public selectedColumn: number | undefined = undefined;
        public columns: Header[] = [];
        public colors: string[] = CColors;

        @Input() public controller!: Columns;
        @Input() public header!: string;

        constructor(cdRef: ChangeDetectorRef) {
            super(cdRef);
        }

        public ngOnDestroy(): void {

        }

        public ngOnChanges() {
        }

        public ngAfterContentInit(): void {
            this.columns = [...this.controller.headers];
        }

        public ngAfterViewInit(): void {

        }

        public ngOnClick(event: MouseEvent, color: string): void {
            event.stopImmediatePropagation();
            event.stopPropagation();
            event.preventDefault();
            const header: Header | undefined = this.controller.headers.find(header => header.caption === this.header);
            if (header) {
                header.color = color;
                this.controller.headers[header.index] = header;
            } else {
                console.log('column not defined');
            }
            this.detectChanges();
        }

        private _setHeaders(headers: Header[]) {
        }
}
