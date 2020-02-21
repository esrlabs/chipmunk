import { SidebarAppSearchManagerComponent } from '../components/sidebar/search.manager/component';
import { SidebarAppMergeFilesComponent } from '../components/sidebar/merge/component';
import { SidebarAppConcatFilesComponent } from '../components/sidebar/concat/component';
import { SidebarAppDLTConnectorComponent } from '../components/sidebar/dlt.connector/component';
import { ITab } from 'chipmunk-client-material';

export { ITab };

export const CGuids = {
    search: 'search',
    merging: 'merging',
    concat: 'concat',
    dltdeamon: 'dltdeamon',
};

export interface IDefaultSidebarApp {
    addedAsDefault: boolean;
    tab: ITab;
}

export const DefaultSidebarApps: IDefaultSidebarApp[] = [
    {
        addedAsDefault: true,
        tab: {
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
    },
    {
        addedAsDefault: false,
        tab: {
            guid: CGuids.merging,
            name: 'Merging',
            content: {
                factory: SidebarAppMergeFilesComponent,
                resolved: false,
                inputs: {},
            },
            closable: true,
            active: true,
        },
    },
    {
        addedAsDefault: false,
        tab: {
            guid: CGuids.concat,
            name: 'Concat',
            content: {
                factory: SidebarAppConcatFilesComponent,
                resolved: false,
                inputs: {},
            },
            closable: true,
            active: true,
        }
    },
    {
        addedAsDefault: false,
        tab: {
            guid: CGuids.dltdeamon,
            name: 'DLT Deamon',
            content: {
                factory: SidebarAppDLTConnectorComponent,
                resolved: false,
                inputs: {},
            },
            closable: true,
            active: true,
        }
    }
];


