import * as Toolkit from 'chipmunk.client.toolkit';

import { ViewSearchComponent } from '../components/views/search/component';
import { SidebarAppNotificationsComponent } from '../components/views/notifications/component';
import { SidebarAppNotificationsCounterComponent } from '../components/views/notifications/counter/component';
import { ViewChartComponent } from '../components/views/chart/component';
import { ViewMeasurementComponent } from '../components/views/measurement/component';

export const CDefaultTabsGuids: Toolkit.IDefaultTabsGuids = {
    search: Toolkit.guid(),
    charts: Toolkit.guid(),
    notification: Toolkit.guid(),
    timemeasurement: Toolkit.guid(),
};

export interface IDefaultView {
    name: string;
    guid: string;
    factory: any;
    tabCaptionInjection?: any;
    inputs: { [key: string]: any };
    default?: boolean;
    closable: boolean;
}

export const DefaultViews: IDefaultView[] = [
    {
        name: 'Time Measurement',
        guid: CDefaultTabsGuids.timemeasurement,
        factory: ViewMeasurementComponent,
        inputs: {},
        closable: true,
    },
    {
        name: 'Charts',
        guid: CDefaultTabsGuids.charts,
        factory: ViewChartComponent,
        inputs: {},
        closable: true,
    },
    {
        name: 'Notifications',
        guid: CDefaultTabsGuids.notification,
        factory: SidebarAppNotificationsComponent,
        tabCaptionInjection: SidebarAppNotificationsCounterComponent,
        inputs: {},
        closable: true,
    },
    {
        name: 'Search',
        guid: CDefaultTabsGuids.search,
        factory: ViewSearchComponent,
        inputs: {},
        default: true,
        closable: false,
    },
];
