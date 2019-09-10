import Logger from './env.logger';
import Fork, { IForkSettings } from './process.fork';
import * as EnvModule from './process.env';
import CommunicationsService from './communication.streams';

export interface IStreamInfo {
    forks: Map<number, Fork>;
    streamId: string;
    settings: IForkSettings|undefined;
    state: IStreamState;
}

export enum IStreamState {
    Opened,
    Ready,
}

export class StreamsService {

    private _logger: Logger = new Logger('StreamsService');
    private _streams: Map<string, IStreamInfo> = new Map();

    constructor() {
        this._onRequestOpenStream = this._onRequestOpenStream.bind(this);
        this._onRequestCloseStream = this._onRequestCloseStream.bind(this);

        CommunicationsService.on(CommunicationsService.Request.onOpenStream, this._onRequestOpenStream);
        CommunicationsService.on(CommunicationsService.Request.onCloseStream, this._onRequestCloseStream);
    }

    private _getInitialOSEnv(defaults: EnvModule.TEnvVars): EnvModule.TEnvVars {
        defaults.TERM = 'xterm-256color';
        return defaults;
    }

    private _onRequestOpenStream(streamId: string): string | undefined {
        if (this._streams.has(streamId)) {
            return this._logger.warn(`The Stream "${streamId}" already exists.`);
        }

        // Fast first reference of stream,
        // will be updated later-on in the initialization-process
        this._streams.set(streamId, {
            forks: new Map(),
            streamId: streamId,
            settings: undefined,
            state: IStreamState.Opened,
        });

        // TODO: handle reject-case for createStream
        new Promise((resolve) => {
            EnvModule.getOSEnvVars().then((env: EnvModule.TEnvVars) => {
                //Apply default terminal color scheme
                this._createStream(streamId, EnvModule.getHomePath(), this._getInitialOSEnv(env))
                .finally(() => {resolve()});
            }).catch((error: Error) => {
                this._logger.warn(`Failed to get OS env-vars for stream ${streamId} due to error: ${error.message}. Default node-values will be used .`);
                this._createStream(
                    streamId, EnvModule.getHomePath(),
                    this._getInitialOSEnv(Object.assign({}, process.env) as EnvModule.TEnvVars))
                .then(() => {resolve()});
            });
        }).then(() => {
            CommunicationsService.emit(
                CommunicationsService.Resolve.onOpenStream, streamId);
        });
    }

    private _onRequestCloseStream(streamId: string): string | undefined {
        const stream: IStreamInfo | undefined = this.get(streamId);
        if (stream === undefined) {
            return this._logger.warn(`Stream "${streamId}" has already been closed.`);
        }

        // Destroy all running forks
        stream.forks.forEach(process => process.destroy());
        this._streams.delete(streamId);

        // Emit that stream was closed successfully
        CommunicationsService.emit(
            CommunicationsService.Resolve.onCloseStream, streamId);
    }

    private _createStream(streamId: string, cwd: string, env: EnvModule.TEnvVars): Promise<void> {
        return new Promise((resolve, reject) => {
            EnvModule.defaultShell().then((userShell: string) => {
                // Update stream
                this._streams.set(streamId, {
                    forks: new Map(),
                    streamId: streamId,
                    settings: {
                        cwd: cwd,
                        shell: userShell,
                        env: env
                    },
                    state: IStreamState.Ready,
                });
                this._logger.env(`Stream "${streamId}" was bound with cwd: "${cwd}".`);
                resolve();
            }).catch((gettingShellErr: Error) => {
                this._logger.env(`Failed to initialize stream "${streamId}" due to error: ${gettingShellErr.message}.`);
                reject();
            });
        });
    }

    public get(streamId: string): IStreamInfo | undefined {
        return this._streams.get(streamId);
    }

    public refFork(streamId: string, command: string, commandId: number): Error | undefined {
        const stream: IStreamInfo | undefined = this.get(streamId);
        if (stream === undefined) {
            return new Error(`Stream with id="${streamId}" was not found. Cannot set fork.`);
        }
        if (stream.state !== IStreamState.Ready) {
            return new Error(this._logger.warn(`Stream "${streamId}" is not yet ready for tasks.`));
        }
        if (stream.settings === undefined) {
            return new Error(this._logger.warn(`Settings of stream "${streamId}" are undefined. Cannot fork task.`));
        }

        // Does fork already exist? (previous commands still running)
        if (stream.forks.has(commandId)) {
            return new Error(`Stream "${streamId}" already has a running fork with id="${commandId}". Cannot start task.`);
        }

        // Create new fork to execute command
        const newFork: Fork = new Fork({
            cmd: command,
            settings: stream.settings
        });

        // Attach listeners
        newFork.on(Fork.Events.data, (chunk) => {
            CommunicationsService.emit(
                CommunicationsService.Events.onSendToStream, streamId, chunk);
        });
        newFork.on(Fork.Events.exit, () => {
            this.unrefFork(streamId, commandId);
        });

        // Save fork
        stream.forks.set(commandId, newFork);
        this._streams.set(streamId, stream);

        // Start fork
        newFork.execute();

        CommunicationsService.emit(
            CommunicationsService.Events.onForkStarted, streamId, commandId);
    }

    public unrefFork(streamId: string, commandId: number): Error | undefined {
        const stream: IStreamInfo | undefined = this.get(streamId);
        if (stream === undefined) {
            return new Error(`Stream with id="${streamId}" was not found. Cannot close fork.`);
        }

        let fork = stream.forks.get(commandId);
        if (fork && !fork.isClosed()) {
            fork.destroy();
        }
        stream.forks.delete(commandId);
        this._streams.set(streamId, stream);

        CommunicationsService.emit(
            CommunicationsService.Events.onForkClosed, streamId, commandId);
    }

    public updateSettings(streamId: string, settings?: IForkSettings): Error | undefined {
        const stream: IStreamInfo | undefined = this.get(streamId);
        if (stream === undefined) {
            return new Error(`Stream with id="${streamId}" was not found. Cannot update settings.`);
        }
        if (settings !== undefined) {
            stream.settings = Object.assign({}, settings);
            this._streams.set(streamId, stream);
        }

        CommunicationsService.emit(
            CommunicationsService.Events.onSettingsUpdated,
            streamId, stream.settings);
    }
}

export default (new StreamsService());
