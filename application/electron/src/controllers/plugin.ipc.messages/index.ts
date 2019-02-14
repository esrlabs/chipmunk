import { PluginState, EPluginState, IPluginState } from './plugin.state';
export { PluginState, EPluginState, IPluginState };

import { PluginRenderMessage, IPluginRenderMessage } from './plugin.render.message';
export { PluginRenderMessage, IPluginRenderMessage };

import { PluginError, IPluginError } from './plugin.error';
export { PluginError, IPluginError };

import { IPluginMessage, PluginMessage } from './plugin.message';
export { IPluginMessage, PluginMessage };

import { IPluginToken, PluginToken } from './plugin.token';
export { IPluginToken, PluginToken };

// Common type for expected message implementation
export type TMessage =  PluginState |
                        PluginRenderMessage |
                        PluginError |
                        PluginMessage |
                        PluginToken;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
* Mapping of host/render events
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *  */
export const Map = {

    [PluginState.signature          ]: PluginState,
    [PluginRenderMessage.signature  ]: PluginRenderMessage,
    [PluginError.signature          ]: PluginError,
    [PluginMessage.signature        ]: PluginMessage,
    [PluginToken.signature          ]: PluginToken,

};
