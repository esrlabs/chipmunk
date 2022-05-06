import { unique } from '@platform/env/sequence';
// import { ViewSearchComponent } from '@views/search/component';
// import { SidebarAppNotificationsComponent } from '@views/notifications/component';
// import { SidebarAppNotificationsCounterComponent } from '@views/notifications/counter/component';
// import { ViewChartComponent } from '@views/chart/component';

export enum Available {
    Search = 'Search',
    Charts = 'Charts',
    TimeMeasurement = 'TimeMeasurement',
    Notifications = 'Notifications',
    Details = 'Details',
}

export const UUIDs = {
    search: unique(),
    charts: unique(),
    notification: unique(),
    timemeasurement: unique(),
    details: unique(),
};

export interface IView {
    name: string;
    uuid: string;
    factory: any;
    tabCaptionInjection?: any;
    inputs: { [key: string]: any };
    default?: boolean;
    closable: boolean;
}

export const DEFAULTS: IView[] = [
    // {
    //     name: 'Time Measurement',
    //     uuid: UUIDs.timemeasurement,
    //     factory: ViewMeasurementComponent,
    //     inputs: {},
    //     closable: true,
    // },
    // {
    //     name: 'Charts',
    //     uuid: UUIDs.charts,
    //     factory: ViewChartComponent,
    //     inputs: {},
    //     closable: true,
    // },
    // {
    //     name: 'Notifications',
    //     uuid: UUIDs.notification,
    //     factory: SidebarAppNotificationsComponent,
    //     tabCaptionInjection: SidebarAppNotificationsCounterComponent,
    //     inputs: {},
    //     closable: true,
    // },
    // {
    //     name: 'Search',
    //     uuid: UUIDs.search,
    //     factory: ViewSearchComponent,
    //     inputs: {},
    //     default: true,
    //     closable: false,
    // },
];
