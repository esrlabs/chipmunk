import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { SidebarAppChartsControlsComponent } from '../controls/component';
import SidebarSessionsService from '../../../../services/service.sessions.sidebar';
import * as Toolkit from 'logviewer.client.toolkit';

/*
    Note
    We are using this component to avoid circular dependencies related with SidebarSessionsService.
    It doesn't have any functionlity and any other goals
*/

@Component({
    selector: 'app-sidebar-app-chartscaller-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppChartsControlsCallerComponent implements AfterViewInit, OnDestroy {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppChartsControlsCallerComponent');

    ngAfterViewInit() {
        SidebarSessionsService.setTitleInjection({
            factory: SidebarAppChartsControlsComponent,
            resolved: false,
            inputs: {

            }
        });
    }

    ngOnDestroy() {
        // SidebarSessionsService.setTitleInjection(undefined);
    }

}
