import * as Toolkit from 'chipmunk.client.toolkit';
import { ViewSearchComponent } from '../components/views/search/component';
import { SidebarAppNotificationsComponent } from '../components/views/notifications/component';
import { SidebarAppNotificationsCounterComponent } from '../components/views/notifications/counter/component';
import { ViewChartComponent } from '../components/views/chart/component';
import { ViewPluginsComponent } from '../components/views/plugins/component';

export interface IDefaultTabsGuids {
    search: string;
    charts: string;
    notification: string;
    plugins: string;
}

export const CDefaultTabsGuids: IDefaultTabsGuids = {
    search: Toolkit.guid(),
    charts: Toolkit.guid(),
    notification: Toolkit.guid(),
    plugins: Toolkit.guid(),
};


export const DefaultViews = [
    {
        name: 'Plugins',
        guid: CDefaultTabsGuids.plugins,
        factory: ViewPluginsComponent,
        inputs: { }
    },
    {
        name: 'Charts',
        guid: CDefaultTabsGuids.charts,
        factory: ViewChartComponent,
        inputs: { }
    },
    {
        name: 'Notifications',
        guid: CDefaultTabsGuids.notification,
        factory: SidebarAppNotificationsComponent,
        tabCaptionInjection: SidebarAppNotificationsCounterComponent,
        inputs: { }
    },
    {
        name: 'Search',
        guid: CDefaultTabsGuids.search,
        factory: ViewSearchComponent,
        inputs: { }
    },
];
