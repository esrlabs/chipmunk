export enum Hotkey {
    newTab = 'newTab',
    closeTab = 'closeTab',
    openLocalFile = 'openLocalFile',
    focusSearchInput = 'focusSearchInput',
    openSearchFiltersTab = 'openSearchFiltersTab',
    selectNextRow = 'selectNextRow',
    selectPrevRow = 'selectPrevRow',
    scrollToBegin = 'scrollToBegin',
    scrollToEnd = 'scrollToEnd',
    focusMainView = 'focusMainView',
    focusSearchView = 'focusSearchView',
    showHotkeysMapDialog = 'showHotkeysMapDialog',
    sidebarToggle = 'sidebarToggle',
    toolbarToggle = 'toolbarToggle',
    recentFiles = 'recentFiles',
    recentFilters = 'recentFilters',
    settings = 'settings',
    nextTab = 'nextTab',
    prevTab = 'prevTab',
    storeFilter = 'storeFilter',
    storeChart = 'storeChart',
    selectAllSearchResult = 'selectAllSearchResult',
}
export interface HotkeyEvent {
    key: Hotkey;
}
