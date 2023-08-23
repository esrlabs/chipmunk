import { Component, AfterViewInit, ChangeDetectorRef, NgZone, HostBinding } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DomSanitizer } from '@angular/platform-browser';
import { setDomSanitizer, setNgZone } from '@ui/env/globals';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.less'],
})
@Ilc()
export class AppComponent extends ChangesDetector implements AfterViewInit {
    @HostBinding('@.disabled')
    public animationsDisabled = false;

    constructor(cdRef: ChangeDetectorRef, sanitizer: DomSanitizer, private ngZone: NgZone) {
        super(cdRef);
        setDomSanitizer(sanitizer);
    }

    public ngAfterViewInit(): void {
        setNgZone(this.ngZone);
        this.ilc().services.system.state.setClientAsReady();
        this.ilc()
            .services.system.changelogs.check()
            .catch((err: Error) => {
                this.log().error(`Fail to check changelogs; error: ${err.message}`);
            });
    }
}
export interface AppComponent extends IlcInterface {}
