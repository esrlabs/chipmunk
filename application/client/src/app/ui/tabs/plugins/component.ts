import { Component, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
//TODO:
// import { State } from './state';

@Component({
    selector: 'app-tabs-plugins-manager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class PluginsManager extends ChangesDetector implements AfterContentInit {
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        //TODO: Call plugins service and render the info
        console.log('DEBUG: After initial plugins manager');
    }
}

export interface PluginsManager extends IlcInterface {}
