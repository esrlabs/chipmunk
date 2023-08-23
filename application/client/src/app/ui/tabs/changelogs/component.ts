import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { micromark } from 'micromark';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-tabs-changelog',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class Changelog extends ChangesDetector implements AfterContentInit {
    @Input() markdown!: string;
    @Input() version!: string;

    public html!: SafeHtml;

    constructor(cdRef: ChangeDetectorRef, protected readonly sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.html = this.sanitizer.bypassSecurityTrustHtml(micromark(this.markdown));
    }
}
export interface Changelog extends IlcInterface {}
