import { SidebarAppSearchManagerComponent } from '../components/sidebar/search.manager/component';
import { ITab } from 'logviewer-client-complex';

export { ITab };

export const CGuids = {
    search: 'search',
    merging: 'merging',
    concat: 'concat',
};

export const DefaultSidebarApps: ITab[] = [
    {
        guid: CGuids.search,
        name: 'Search',
        content: {
            factory: SidebarAppSearchManagerComponent,
            resolved: false,
            inputs: {},
        },
        closable: false,
        active: true,
    }
];


