import Logger from './env.logger';
import PluginIPCService from 'logviewer.plugin.ipc';
import { IPCMessages } from 'logviewer.plugin.ipc';
import { EventEmitter } from 'events';
import { IForkSettings } from './process.fork';
import StreamsService, { IStreamState, IStreamInfo } from './service.streams';

class CommunicationsService extends EventEmitter {

    public Request = {
        onStop: 'onRequestStop',
        onWrite: 'onRequestWrite',
        onCommand: 'onRequestCommand',
        onSettings: 'onRequestSettings',
        onOpenStream: 'onRequestOpenStream',
        onCloseStream: 'onRequestCloseStream',
    };

    public Resolve = {
        onStop: 'onResolvedStop',
        onWrite: 'onResolvedWrite',
        onCommand: 'onResolvedCommand',
        onSettings: 'onResolvedSettings',
        onOpenStream: 'onResolvedOpenStream',
        onCloseStream: 'onResolvedCloseStream',
    };

    public Events = {
        onForkClosed: 'onForkClosed',
        onForkStarted: 'onForkStarted',
        onSendToStream: 'onSendToStream',
        onSettingsUpdated: 'SettingsUpdated',
    };

    private _logger: Logger = new Logger('CommunicationsService');

    constructor() {
        super();

        // Subscribe to IPCs

        this._onIPCMessageRequest = this._onIPCMessageRequest.bind(this);
        this._onRequestOpenStream = this._onRequestOpenStream.bind(this);
        this._onRequestCloseStream = this._onRequestCloseStream.bind(this);

        PluginIPCService.subscribe(IPCMessages.PluginInternalMessage, this._onIPCMessageRequest);
        PluginIPCService.on(PluginIPCService.Events.openStream, this._onRequestOpenStream);
        PluginIPCService.on(PluginIPCService.Events.closeStream, this._onRequestCloseStream);

        // Subscribe to 'resolved'-events

        this._onResolvedStop = this._onResolvedStop.bind(this);
        this._onResolvedWrite = this._onResolvedWrite.bind(this);
        this._onResolvedCommand = this._onResolvedCommand.bind(this);
        this._onResolvedSettings = this._onResolvedSettings.bind(this);
        this._onResolvedStreamReady = this._onResolvedStreamReady.bind(this);
        this._onResolvedStreamClosed = this._onResolvedStreamClosed.bind(this);

        this.on(this.Resolve.onStop, this._onResolvedStop);
        this.on(this.Resolve.onWrite, this._onResolvedWrite);
        this.on(this.Resolve.onCommand, this._onResolvedCommand);
        this.on(this.Resolve.onSettings, this._onResolvedSettings);
        this.on(this.Resolve.onOpenStream, this._onResolvedStreamReady);
        this.on(this.Resolve.onCloseStream, this._onResolvedStreamClosed);

        // Subscribe to events

        this._onForkClosed = this._onForkClosed.bind(this);
        this._onForkStarted = this._onForkStarted.bind(this);
        this._onSendToStream = this._onSendToStream.bind(this);
        this._onSettingsUpdated = this._onSettingsUpdated.bind(this);

        this.on(this.Events.onForkClosed, this._onForkClosed);
        this.on(this.Events.onForkStarted, this._onForkStarted);
        this.on(this.Events.onSendToStream, this._onSendToStream);
        this.on(this.Events.onSettingsUpdated, this._onSettingsUpdated);
    }

    private _onIPCMessageRequest(
        message: IPCMessages.PluginInternalMessage,
        response: (res: IPCMessages.TMessage) => any): void {

        const stream: IStreamInfo | undefined = StreamsService.get(message.stream);
        if (stream === undefined) {
            return this._onStreamNonExistent(message.stream);
        }
        if (stream.state !== IStreamState.Ready) {
            return this._onStreamNotReady(message.stream);
        }

        switch (message.data.command) {
            case 'command':
                this.emit(this.Request.onCommand, message, response);
                break;
            case 'stop':
                this.emit(this.Request.onStop, message, response);
                break;
            case 'write':
                this.emit(this.Request.onWrite, message, response);
                break;
            case 'getSettings':
                this.emit(this.Request.onSettings, message, response);
                break;
            default:
                this._logger.warn(`Unknown command: "${message.data.command}"`);
                break;
        }
    }

    private _onStreamNonExistent(streamId: string): void {
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'StreamNonExistent',
            streamId: streamId,
        });
    }

    private _onStreamNotReady(streamId: string): void {
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'StreamNotReady',
            streamId: streamId,
        });
    }

    private _onRequestOpenStream(streamId: string): void {
        this.emit(this.Request.onOpenStream, streamId);
    }

    private _onRequestCloseStream(streamId: string): void {
        this.emit(this.Request.onCloseStream, streamId);
    }

    private _onForkStarted(streamId: string, commandId: number): void {
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'ForkStarted',
            streamId: streamId,
            data: {
                id: commandId,
            },
        });
    }

    private _onForkClosed(streamId: string, commandId: number): void {
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'ForkClosed',
            streamId: streamId,
            data: {
                id: commandId,
            },
        });
    }

    private _onSendToStream(streamId: string, chunk: Buffer): void {
        PluginIPCService.sendToStream(chunk, streamId);
    }

    private _onSettingsUpdated(streamId: string, settings: IForkSettings): void {
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'SettingsUpdated',
            settings: settings,
            streamId: streamId
        });
    }

    private _onResolvedStreamReady(streamId: string): void {
        PluginIPCService.sendToPluginHost(streamId, {
            event: 'StreamReady',
            streamId: streamId,
        });
    }

    private _onResolvedStreamClosed(streamId: string): void {
        //
    }

    private _onResolvedCommand(
        message: IPCMessages.PluginInternalMessage,
        result: any,
        response: (res: IPCMessages.TMessage) => any): any {

        if (result.error) {
            return response(new IPCMessages.PluginError({
                message: result.error,
                stream: message.stream,
                token: message.token,
                data: {
                    id: message.data.id,
                    command: message.data.command
                }
            }));
        }

        return response(new IPCMessages.PluginInternalMessage({
            stream: message.stream,
            token: message.token,
            data: {
                id: message.data.id,
                status: 'done'
            }
        }));
    }

    private _onResolvedStop(
        message: IPCMessages.PluginInternalMessage,
        result: any,
        response: (res: IPCMessages.TMessage) => any): any {

        if (result.error) {
            return response(new IPCMessages.PluginError({
                message: result.error,
                stream: message.stream,
                token: message.token,
                data: {
                    id: message.data.id,
                    command: message.data.command
                }
            }));
        }
        return response(new IPCMessages.PluginInternalMessage({
            stream: message.stream,
            token: message.token,
            data: {
                id: message.data.id,
                status: 'done'
            }
        }));
    }

    private _onResolvedWrite(
        message: IPCMessages.PluginInternalMessage,
        result: any,
        response: (res: IPCMessages.TMessage) => any): any {

        if (result.error) {
            return response(new IPCMessages.PluginError({
                message: result.error,
                stream: message.stream,
                token: message.token,
                data: {
                    id: message.data.id,
                    command: message.data.command
                }
            }));
        }
        return response(new IPCMessages.PluginInternalMessage({
            stream: message.stream,
            token: message.token,
            data: {
                id: message.data.id,
                status: 'done'
            }
        }));
    }

    private _onResolvedSettings(
        message: IPCMessages.PluginInternalMessage,
        result: any,
        response: (res: IPCMessages.TMessage) => any): any {

        if (result.error) {
            return response(new IPCMessages.PluginError({
                message: result.error,
                stream: message.stream,
                token: message.token,
                data: {
                    command: message.data.command
                }
            }));
        }

        return response(new IPCMessages.PluginInternalMessage({
            stream: message.stream,
            token: message.token,
            data: {
                settings: result.settings
            }
        }));
    }
}

export default (new CommunicationsService());
