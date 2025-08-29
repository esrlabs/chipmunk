import { v4 } from 'uuid';
import { Inputs } from '@platform/entity/service';

/**
 * Central service registration table for the entire system.
 *
 * @remarks
 * Every service in the application **must** be registered in this table with a unique name and UUID.
 * The UUID serves as a persistent identity used by the dependency resolver to manage initialization
 * order and inter-service communication.
 *
 * This registry is **mandatory**: it ensures consistent identification of services across the
 * application lifecycle and guarantees correct dependency resolution.
 *
 * Developers must:
 * - Assign a **globally unique UUID** to each service (automatically generated here via `v4()`).
 * - Use the same registration entry when applying decorators like `@SetupService(...)` or `@DependOn(...)`.
 *
 * @example Dependency declaration
 * ```ts
 * @DependOn(api) // Ensures `MyNewService` is initialized after the `api` service
 * @SetupService(services['my_new_service'])
 * class MyNewService { ... }
 * ```
 *
 * @warning
 * Avoid reusing UUIDs or manually copying them between services.
 * UUIDs should remain stable for the life of the service type.
 *
 * @constant
 * @public
 */
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
    plugins: {
        name: 'Plugins',
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
    dropfiles: {
        name: 'DragAndDropFiles',
        uuid: v4(),
    },
};
