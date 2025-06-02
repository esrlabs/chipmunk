import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    Input,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { micromark } from 'micromark';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import * as dom from '@ui/env/dom';
import { bridge } from '@service/bridge';

@Component({
    selector: 'app-tabs-changelog',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Changelog extends ChangesDetector implements AfterContentInit, AfterViewInit {
    @Input() markdown!: string;
    @Input() version!: string;
    @ViewChild('content') contentRef!: ElementRef<HTMLElement>;

    public html!: SafeHtml;

    constructor(cdRef: ChangeDetectorRef, protected readonly sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.html = this.sanitizer.bypassSecurityTrustHtml(micromark(this.markdown));
    }

    public ngAfterViewInit(): void {
        const links = this.contentRef.nativeElement.querySelectorAll('a');
        if (links === null) {
            return;
        }
        links.forEach((link: HTMLAnchorElement) => {
            link.addEventListener('click', this.redirect);
        });
    }

    protected redirect(event: MouseEvent): void {
        dom.stop(event);
        const url = (event.target as HTMLAnchorElement).href;
        bridge
            .browser()
            .url(url)
            .catch((err: Error) => {
                this.log().error(`Fail to open URL "${url}": ${err.message}`);
            });
    }
}
export interface Changelog extends IlcInterface {}
