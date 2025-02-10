import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    ipc: {
        send: (channel: string, msg: unknown) => ipcRenderer.send(channel, msg),
        subscribe: (channel: string, callback: (...args: unknown[]) => void) =>
            ipcRenderer.on(channel, callback),
        unsubscribe: (channel: string, callback: (...args: unknown[]) => void) =>
            ipcRenderer.removeListener(channel, callback),
        unsubscribeAll: (channel: string) => ipcRenderer.removeAllListeners(channel),
    },
    webUtils: {
        getPathForFile: (file: File) => webUtils.getPathForFile(file),
    },
});
