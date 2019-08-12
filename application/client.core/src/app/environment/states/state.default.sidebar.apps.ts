import { SidebarAppSearchManagerComponent       } from '../components/sidebar/search.manager/component';

export const CGuids = {
    search: 'search',
    merging: 'merging',
    concat: 'concat',
};

export const DefaultSidebarApps: IDefaultSideBarApp[] = [
    {
        guid: CGuids.search,
        name: 'Search',
        component: SidebarAppSearchManagerComponent,
        closable: false,
    }
];

export interface IDefaultSideBarApp {
    guid: string;
    name: string;
    component: any;
    closable: boolean;
}

