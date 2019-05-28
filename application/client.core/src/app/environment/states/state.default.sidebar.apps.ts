import { SidebarAppMergeFilesComponent          } from '../components/sidebar/merge/component';
import { SidebarAppSearchManagerComponent       } from '../components/sidebar/search.manager/component';

export const DefaultSidebarApps = [
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
