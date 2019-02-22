import { HostState, EHostState, IHostState } from './host.state';
export { HostState, EHostState, IHostState };

import { HostStateHistory } from './host.state.history';
export { HostStateHistory };

import { IRenderMountPlugin, RenderMountPlugin } from './render.plugin.mount';
export { IRenderMountPlugin, RenderMountPlugin };

import { IRenderState, RenderState, ERenderState } from './render.state';
export { IRenderState, RenderState, ERenderState };

import { IPluginMessage, PluginMessage } from './plugin.message';
export { IPluginMessage, PluginMessage };

import { IStreamAdd, StreamAdd } from './stream.add';
export { IStreamAdd, StreamAdd };

import { IStreamRemove, StreamRemove } from './stream.remove';
export { IStreamRemove, StreamRemove };

// Common type for expected message implementation
export type TMessage =  HostState |
                        HostStateHistory |
                        RenderMountPlugin |
                        RenderState |
                        PluginMessage |
                        StreamAdd |
                        StreamRemove;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
* Mapping of host/render events
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *  */
export const Map = {

    [HostState.signature            ]: HostState,
    [HostStateHistory.signature     ]: HostStateHistory,
    [RenderMountPlugin.signature    ]: RenderMountPlugin,
    [RenderState.signature          ]: RenderState,
    [PluginMessage.signature        ]: PluginMessage,
    [StreamAdd.signature            ]: StreamAdd,
    [StreamRemove.signature         ]: StreamRemove,

};
