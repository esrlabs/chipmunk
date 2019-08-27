import Logger from './env.logger';
import PluginIPCService from 'logviewer.plugin.ipc';
import Fork, { IForkSettings } from './process.fork';
import * as EnvModule from './process.env';
import { EventEmitter } from 'events';

export interface IStreamInfo {
    fork: Fork | undefined;
    streamId: string;
    settings: IForkSettings;
}

class StreamsService extends EventEmitter {

    public Events = {
        onStreamOpened: 'onStreamOpened',
        onStreamClosed: 'onStreamClosed',
    };

    private _logger: Logger = new Logger('StreamsService');
    private _streams: Map<string, IStreamInfo> = new Map();

    constructor() {
        super();
        this._onOpenStream = this._onOpenStream.bind(this);
        this._onCloseStream = this._onCloseStream.bind(this);
        PluginIPCService.on(PluginIPCService.Events.openStream, this._onOpenStream);
        PluginIPCService.on(PluginIPCService.Events.closeStream, this._onCloseStream);
    }

    public get(streamId: string): IStreamInfo | undefined {
        return this._streams.get(streamId);
    }

    public refFork(streamId: string, command: string): Error | undefined {
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return new Error(`Stream ${streamId} is not found. Cannot set fork.`);
        }
        // Check: does fork already exist (previous commands still running)
        if (stream.fork !== undefined) {
            return new Error(`Stream ${streamId} has running fork, cannot start other.`);
        }
        // Create fork to execute command
        const fork: Fork = new Fork({ 
            cmd: command,
            settings: stream.settings
        });
        // Attach listeners
        fork.on(Fork.Events.data, (chunk) => {
            PluginIPCService.sendToStream(chunk, streamId);
        });
        fork.on(Fork.Events.exit, () => {
            this.unrefFork(streamId);
        });
        // Save fork
        stream.fork = fork;
        this._streams.set(streamId, stream);
        // Start forl
        fork.execute();
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'ForkStarted',
            streamId: streamId
        });
    }

    public unrefFork(streamId: string): Error | undefined {
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return new Error(`Stream ${streamId} is not found. Cannot set fork.`);
        }
        if (stream.fork !== undefined && !stream.fork.isClosed()) {
            stream.fork.destroy();
        }
        stream.fork = undefined;
        this._streams.set(streamId, stream);
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'ForkClosed',
            streamId: streamId
        });
    }

    public updateSettings(streamId: string, settings?: IForkSettings): Error | undefined {
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return new Error(`Stream ${streamId} is not found. Cannot update settings.`);
        }
        if (settings !== undefined) {
            stream.settings = Object.assign({}, settings);
            this._streams.set(streamId, stream);
        }
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'SettingsUpdated',
            settings: stream.settings,
            streamId: streamId
        });
    }

    private _getInitialOSEnv(defaults: EnvModule.TEnvVars): EnvModule.TEnvVars {
        defaults.TERM = 'xterm-256color';
        return defaults;
    }

    private _onOpenStream(streamId: string) {
        if (this._streams.has(streamId)) {
            return this._logger.warn(`Stream ${streamId} is already created.`);
        }
        EnvModule.getOSEnvVars().then((env: EnvModule.TEnvVars) => {
            //Apply default terminal color scheme
            this._createStream(streamId, EnvModule.getExecutedModulePath(), this._getInitialOSEnv(env));
        }).catch((error: Error) => {
            this._logger.warn(`Fail to get OS env vars  for stream ${streamId} due error: ${error.message}. Will be used default node values.`);
            this._createStream(streamId, EnvModule.getExecutedModulePath(), this._getInitialOSEnv(Object.assign({}, process.env) as EnvModule.TEnvVars));
        });
    }

    private _onCloseStream(streamId: string) {
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return this._logger.warn(`Stream ${streamId} is already closed.`);
        }
        // Check fork before (if it's still working)
        if (stream.fork !== undefined) {
            stream.fork.destroy();
        }
        // Remove stream now
        this._streams.delete(streamId);
        this.emit(this.Events.onStreamClosed, streamId);
    }

    private _createStream(streamId: string, cwd: string, env: EnvModule.TEnvVars) {
        EnvModule.defaultShell().then((userShell: string) => {
            this._streams.set(streamId, {
                fork: undefined,
                streamId: streamId,
                settings: {
                    cwd: cwd,
                    shell: userShell,
                    env: env
                }
            });
            this.emit(this.Events.onStreamOpened, streamId);
            this._logger.env(`Stream "${streamId}" is bound with cwd "${cwd}".`)
        }).catch((gettingShellErr: Error) => {
            this._logger.env(`Failed to create stream "${streamId}" due to error: ${gettingShellErr.message}.`)
        });
    }
}

export default (new StreamsService());