export enum EHotkeyActionRef {
    newTab = 'newTab',
    closeTab = 'closeTab',
    openTextFile = 'openTextFile',
    openDltFile = 'openDltFile',
    focusSearchInput = 'focusSearchInput',
    openSearchFiltersTab = 'openSearchFiltersTab',
    openMergeTab = 'openMergeTab',
    selectNextRow = 'selectNextRow',
    selectPrevRow = 'selectPrevRow',
    focusMainView = 'focusMainView',
    focusSearchView = 'focusSearchView',
    showHotkeysMapDialog = 'showHotkeysMapDialog',
    sidebarToggle = 'sidebarToggle',
    toolbarToggle = 'toolbarToggle',
}

export interface IHotkeyCall {
    unixtime: number;
    session: string;
    action: EHotkeyActionRef | string;
}

export class HotkeyCall {

    public static Actions = EHotkeyActionRef;
    public static signature: string = 'HotkeyCall';
    public signature: string = HotkeyCall.signature;
    public action: EHotkeyActionRef | string;
    public session: string | undefined;
    public unixtime: number | undefined;

    constructor(params: IHotkeyCall) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HotkeyCall message`);
        }
        this.session = params.session;
        this.action = params.action;
        this.unixtime = params.unixtime;
    }

}
