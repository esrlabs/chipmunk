import { Component, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';

@Component({
    selector: 'app-dialogs-about',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class About extends ChangesDetector implements AfterViewInit {
    @Input() public version: string = '';
    @Input() public alphaRelease: { version: string; url: string } | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit(): void {
        Promise.all([
            this.ilc().services.system.bridge.app().version(),
            this.ilc().services.system.bridge.app().alphaRelease(),
        ])
            .then(([version, alphaRelease]) => {
                this.version = version;
                this.alphaRelease = alphaRelease;
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get about dialog data: ${err.message}`);
            });
    }

    public open(url: string): void {
        this.ilc()
            .services.system.bridge.browser()
            .url(url)
            .catch((err: Error) => {
                this.log().error(`Fail to open URL "${url}": ${err.message}`);
            });
    }
}
export interface About extends IlcInterface {}
