import { SidebarAppMergeFilesComponent          } from '../components/sidebar/merge/component';
import { SidebarAppSearchManagerComponent       } from '../components/sidebar/search.manager/component';

export const DefaultSidebarApps = [
    {
        name: 'Search',
        component: SidebarAppSearchManagerComponent,
    },
    {
        name: 'Merging',
        component: SidebarAppMergeFilesComponent,
    },
];
