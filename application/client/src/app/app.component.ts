import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DomSanitizer } from '@angular/platform-browser';
import { setDomSanitizer } from '@ui/env/globals';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.less'],
})
@Ilc()
export class AppComponent extends ChangesDetector implements AfterViewInit {
    constructor(cdRef: ChangeDetectorRef, sanitizer: DomSanitizer) {
        super(cdRef);
        setDomSanitizer(sanitizer);
        // This solution doesn't work. It breaks some angular lifecycle
        // this.ilc().channel.system.ready(() => {
        //     this.ilc().services.system.state.setClientAsReady();
        // });
    }

    public ngAfterViewInit(): void {
        this.ilc().services.system.state.setClientAsReady();
    }
}
export interface AppComponent extends IlcInterface {}
