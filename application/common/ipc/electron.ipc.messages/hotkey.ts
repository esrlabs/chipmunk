export enum EHotkeyActionRef {
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

export interface IHotkeyCall {
    unixtime: number;
    session: string;
    shortcut: string;
    action: EHotkeyActionRef | string;
}

export class HotkeyCall {

    public static Actions = EHotkeyActionRef;
    public static signature: string = 'HotkeyCall';
    public signature: string = HotkeyCall.signature;
    public action: EHotkeyActionRef | string;
    public session: string | undefined;
    public shortcut: string | undefined;
    public unixtime: number | undefined;

    constructor(params: IHotkeyCall) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HotkeyCall message`);
        }
        this.session = params.session;
        this.action = params.action;
        this.shortcut = params.shortcut;
        this.unixtime = params.unixtime;
    }

}
