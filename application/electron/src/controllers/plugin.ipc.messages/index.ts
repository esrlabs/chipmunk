import { PluginState, EPluginState, IPluginState } from './plugin.state';
export { PluginState, EPluginState, IPluginState };

import { PluginRenderMessage, IPluginRenderMessage } from './plugin.render.message';
export { PluginRenderMessage, IPluginRenderMessage };

import { PluginError, IPluginError } from './plugin.error';
export { PluginError, IPluginError };

// Common type for expected message implementation
export type TMessage =  PluginState |
                        PluginRenderMessage |
                        PluginError;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
* Mapping of host/render events
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *  */
export const Map = {

    [PluginState.signature          ]: PluginState,
    [PluginRenderMessage.signature  ]: PluginRenderMessage,
    [PluginError.signature          ]: PluginError,

};
