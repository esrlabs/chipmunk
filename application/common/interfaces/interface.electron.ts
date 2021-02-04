export interface IpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): this;
    once(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): this;
    postMessage(channel: string, message: any, transfer?: MessagePort[]): void;
    removeAllListeners(channel: string): this;
    removeListener(channel: string, listener: (...args: any[]) => void): this;
    send(channel: string, ...args: any[]): void;
    sendSync(channel: string, ...args: any[]): any;
    sendTo(webContentsId: number, channel: string, ...args: any[]): void;
    sendToHost(channel: string, ...args: any[]): void;
}

export interface IpcRendererEvent extends Event {
    ports: MessagePort[];
    sender: IpcRenderer;
    senderId: number;
}

export interface FileFilter {
    extensions: string[];
    name: string;
}

export interface OpenDialogOptions {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: FileFilter[];
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'>;
    message?: string;
    securityScopedBookmarks?: boolean;
}

export interface OpenDialogReturnValue {
    canceled: boolean;
    filePaths: string[];
    bookmarks?: string[];
}