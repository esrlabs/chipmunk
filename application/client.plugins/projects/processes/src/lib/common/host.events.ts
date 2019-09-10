export enum EHostEvents {
    ForkStarted = 'ForkStarted',
    ForkClosed = 'ForkClosed',
    SettingsUpdated = 'SettingsUpdated',
    StreamReady = 'StreamReady',
    StreamNotRead = 'StreamNotReady',
    StreamNonExistent = 'StreamNonExistent',
}

export enum EHostCommands {
    command = 'command',
    write = 'write',
    stop = 'stop',
    getSettings = 'getSettings',
}
