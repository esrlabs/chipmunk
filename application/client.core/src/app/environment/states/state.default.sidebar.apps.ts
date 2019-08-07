import { SidebarAppMergeFilesComponent          } from '../components/sidebar/merge/component';
import { SidebarAppSearchManagerComponent       } from '../components/sidebar/search.manager/component';

export const CGuids = {
    search: 'search',
    merging: 'merging',
};

export const DefaultSidebarApps: IDefaultSideBarApp[] = [
    {
        guid: CGuids.search,
        name: 'Search',
        component: SidebarAppSearchManagerComponent,
    },
    {
        guid: CGuids.merging,
        name: 'Merging',
        component: SidebarAppMergeFilesComponent,
    },
];

export interface IDefaultSideBarApp {
    guid: string;
    name: string;
    component: any;
}

