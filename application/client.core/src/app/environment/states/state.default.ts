import { DefaultViews, IDefaultView } from './state.default.tab.views';
import { DefaultSidebarApps, IDefaultSideBarApp, } from './state.default.sidebar.apps';

export function getDefaultViews(): IDefaultView[] {
    return DefaultViews.slice();
}

export function getDefaultSideBarApps(): IDefaultSideBarApp[] {
    return DefaultSidebarApps.slice();
}

export { IDefaultView, IDefaultSideBarApp };
