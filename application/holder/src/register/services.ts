import { v4 } from 'uuid';
import { Inputs } from 'platform/entity/service';

export const services: { [key: string]: Inputs } = {
    electron: {
        name: 'Electron',
        uuid: v4(),
    },
    paths: {
        name: 'Paths',
        uuid: v4(),
    },
    production: {
        name: 'Production',
        uuid: v4(),
    },
    sessions: {
        name: 'Sessions',
        uuid: v4(),
    },
    jobs: {
        name: 'Jobs',
        uuid: v4(),
    },
    bridge: {
        name: 'Bridge',
        uuid: v4(),
    },
    unbound: {
        name: 'Unbound',
        uuid: v4(),
    },
    storage: {
        name: 'Storage',
        uuid: v4(),
    },
    settings: {
        name: 'Settings',
        uuid: v4(),
    },
    updater: {
        name: 'Updater',
        uuid: v4(),
    },
    notifications: {
        name: 'Notifications',
        uuid: v4(),
    },
    env: {
        name: 'env',
        uuid: v4(),
    },
    hotkeys: {
        name: 'hotkeys',
        uuid: v4(),
    },
    cli: {
        name: 'cli',
        uuid: v4(),
    },
    menu: {
        name: 'menu',
        uuid: v4(),
    },
};
