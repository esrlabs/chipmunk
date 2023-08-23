import { v4 } from 'uuid';
import { Inputs } from '@platform/entity/service';

export const services: { [key: string]: Inputs } = {
    system: {
        name: 'System',
        uuid: v4(),
    },
    env: {
        name: 'Env',
        uuid: v4(),
    },
    api: {
        name: 'API',
        uuid: v4(),
    },
    ilc: {
        name: 'ILC',
        uuid: v4(),
    },
    session: {
        name: 'Session',
        uuid: v4(),
    },
    state: {
        name: 'State',
        uuid: v4(),
    },
    jobs: {
        name: 'Jobs',
        uuid: v4(),
    },
    files: {
        name: 'Files',
        uuid: v4(),
    },
    bridge: {
        name: 'Bridge',
        uuid: v4(),
    },
    recent: {
        name: 'Recent',
        uuid: v4(),
    },
    tabs: {
        name: 'Tabs',
        uuid: v4(),
    },
    hotkeys: {
        name: 'Hotkeys',
        uuid: v4(),
    },
    history: {
        name: 'History',
        uuid: v4(),
    },
    cli: {
        name: 'Cli',
        uuid: v4(),
    },
    actions: {
        name: 'Actions',
        uuid: v4(),
    },
    settings: {
        name: 'Settings',
        uuid: v4(),
    },
    sys: {
        name: 'Sys',
        uuid: v4(),
    },
    favorites: {
        name: 'Favorites',
        uuid: v4(),
    },
    changelogs: {
        name: 'Changelogs',
        uuid: v4(),
    },
};

export const ui: { [key: string]: Inputs } = {
    popup: {
        name: 'Popup',
        uuid: v4(),
    },
    notifications: {
        name: 'Notifications',
        uuid: v4(),
    },
    contextmenu: {
        name: 'Context Menu',
        uuid: v4(),
    },
    layout: {
        name: 'Layout state',
        uuid: v4(),
    },
    tabs: {
        name: 'Tabs',
        uuid: v4(),
    },
    toolbar: {
        name: 'Toolbar',
        uuid: v4(),
    },
    sidebar: {
        name: 'Sidebar',
        uuid: v4(),
    },
    styles: {
        name: 'Styles',
        uuid: v4(),
    },
    bottomsheet: {
        name: 'BottomSheet',
        uuid: v4(),
    },
    listener: {
        name: `Listener`,
        uuid: v4(),
    },
    lockers: {
        name: `Lockers`,
        uuid: v4(),
    },
    filters: {
        name: 'Filters',
        uuid: v4(),
    },
};
