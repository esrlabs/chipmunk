import { DefaultViews, IDefaultView } from './state.default.tab.views';
import { DefaultSidebarApps, ITab } from './state.default.sidebar.apps';

export function getDefaultViews(): IDefaultView[] {
    return DefaultViews.slice();
}

export function getDefaultSideBarApps(): ITab[] {
    return DefaultSidebarApps.slice();
}

export { IDefaultView, ITab };
