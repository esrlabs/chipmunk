import { Component, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';

@Component({
    selector: 'app-dialogs-about',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class About extends ChangesDetector implements AfterViewInit {
    @Input() public version: string = '';

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit(): void {
        this.ilc()
            .services.system.bridge.app()
            .version()
            .then((version: string) => {
                this.version = version;
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get application version: ${err.message}`);
            });
    }

    public open(url: string): void {
        this.ilc()
            .services.system.bridge.brower()
            .url(url)
            .catch((err: Error) => {
                this.log().error(`Fail to open URL "${url}": ${err.message}`);
            });
    }
}
export interface About extends IlcInterface {}
