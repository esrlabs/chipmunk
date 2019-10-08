import { DefaultViews, IDefaultView } from './state.default.tab.views';
import { DefaultSidebarApps, ITab, IDefaultSidebarApp } from './state.default.sidebar.apps';

export function getDefaultViews(): IDefaultView[] {
    return DefaultViews.slice();
}

export function getDefaultSideBarApps(): IDefaultSidebarApp[] {
    return DefaultSidebarApps.slice();
}

export { IDefaultView, ITab };
