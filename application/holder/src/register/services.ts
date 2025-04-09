import { v4 } from 'uuid';
import { Inputs } from 'platform/entity/service';

export const services: { [key: string]: Inputs } = {
    electron: {
        name: 'electron',
        uuid: v4(),
    },
    paths: {
        name: 'paths',
        uuid: v4(),
    },
    production: {
        name: 'production',
        uuid: v4(),
    },
    sessions: {
        name: 'sessions',
        uuid: v4(),
    },
    jobs: {
        name: 'jobs',
        uuid: v4(),
    },
    bridge: {
        name: 'bridge',
        uuid: v4(),
    },
    unbound: {
        name: 'unbound',
        uuid: v4(),
    },
    components: {
        name: 'components',
        uuid: v4(),
    },
    storage: {
        name: 'storage',
        uuid: v4(),
    },
    settings: {
        name: 'settings',
        uuid: v4(),
    },
    updater: {
        name: 'updater',
        uuid: v4(),
    },
    notifications: {
        name: 'notifications',
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
    github: {
        name: 'github',
        uuid: v4(),
    },
};
