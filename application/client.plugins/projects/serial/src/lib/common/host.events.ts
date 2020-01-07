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
    send = 'send',
    spyStart = 'spyStart',
    spyStop = 'spyStop',
    write = 'write',
    read = 'read',
    remove = 'remove'
}
