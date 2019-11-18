export enum EHostEvents {
    connected = 'connected',
    disconnected = 'disconnected',
    error = 'error',
    state = 'state',
    spyState = 'spyState'
}

export enum EHostCommands {
    open = 'open',
    close = 'close',
    list = 'list',
    write = 'write',
    spyStart = 'spyStart',
    spyStop = 'spyStop'
}
