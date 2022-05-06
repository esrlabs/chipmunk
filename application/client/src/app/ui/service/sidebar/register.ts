import { ITab } from '@elements/tabs/service';
// import { SidebarAppSearchManagerComponent } from '@sidebar/search.manager/component';
// import { SidebarAppCommentsComponent } from '@sidebar/comments/component';
// import { SidebarAppMergeFilesComponent } from '@sidebar/merge/component';
// import { SidebarAppConcatFilesComponent } from '@sidebar/concat/component';
// import { SidebarAppDLTConnectorComponent } from '@sidebar/dlt.connector/component';
// import { SidebarAppShellComponent } from '@sidebar/shell/component';
// import { SidebarAppAdbComponent } from '@sidebar/adb/component';

export enum Available {
    SearchManager = 'SearchManager',
    CommentsManager = 'CommentsManager',
    DLTConnector = 'DLTConnector',
    Shell = 'Shell',
    Concat = 'Concat',
    Merge = 'Merge',
}

export const UUIDs = {
    search: 'search',
    merging: 'merging',
    concat: 'concat',
    dltdeamon: 'dltdeamon',
    comments: 'comments',
    shell: 'shell',
    adb: 'adb',
};

export interface IDefault extends ITab {
    default: boolean;
}

export const DEFAULTS: IDefault[] = [
    // {
    //     uuid: UUIDs.search,
    //     name: 'Search',
    //     content: {
    //         factory: SidebarAppSearchManagerComponent,
    //         inputs: {},
    //     },
    //     closable: false,
    //     active: true,
    //     default: true,
    // },
    // {
    //     uuid: UUIDs.comments,
    //     name: 'Comments',
    //     content: {
    //         factory: SidebarAppCommentsComponent,
    //         inputs: {},
    //     },
    //     closable: true,
    //     active: true,
    //     default: true,
    // },
    // {
    //     addedAsDefault: false,
    //     tab: {
    //         uuid: UUIDs.merging,
    //         name: 'Merging',
    //         content: {
    //             factory: SidebarAppMergeFilesComponent,
    //             inputs: {},
    //         },
    //         closable: true,
    //         active: true,
    //     },
    // },
    // {
    //     addedAsDefault: false,
    //     tab: {
    //         uuid: UUIDs.concat,
    //         name: 'Concat',
    //         content: {
    //             factory: SidebarAppConcatFilesComponent,
    //             inputs: {},
    //         },
    //         closable: true,
    //         active: true,
    //     },
    // },
    // {
    //     addedAsDefault: false,
    //     tab: {
    //         uuid: UUIDs.dltdeamon,
    //         name: 'DLT Deamon',
    //         content: {
    //             factory: SidebarAppDLTConnectorComponent,
    //             inputs: {},
    //         },
    //         closable: true,
    //         active: true,
    //     },
    // },
    // {
    //     addedAsDefault: false,
    //     tab: {
    //         uuid: UUIDs.shell,
    //         name: 'Shell',
    //         content: {
    //             factory: SidebarAppShellComponent,
    //             inputs: {},
    //         },
    //         closable: true,
    //         active: true,
    //     },
    // },
    // {
    //     addedAsDefault: false,
    //     tab: {
    //         uuid: UUIDs.adb,
    //         name: 'Adb',
    //         content: {
    //             factory: SidebarAppAdbComponent,
    //             inputs: {},
    //         },
    //         closable: true,
    //         active: true,
    //     },
    // },
];
