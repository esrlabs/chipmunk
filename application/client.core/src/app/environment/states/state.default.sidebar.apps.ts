import { SidebarAppMergeFilesComponent          } from '../components/sidebar/merge/component';
import { SidebarAppSearchManagerComponent       } from '../components/sidebar/search.manager/component';

export const DefaultSidebarApps: IDefaultSideBarApp[] = [
    {
        guid: 'search',
        name: 'Search',
        component: SidebarAppSearchManagerComponent,
    },
    {
        guid: 'merging',
        name: 'Merging',
        component: SidebarAppMergeFilesComponent,
    },
];

export interface IDefaultSideBarApp {
    guid: string;
    name: string;
    component: any;
}

