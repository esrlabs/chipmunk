import { PluginState, EPluginState, IPluginState } from './plugin.state';
export { PluginState, EPluginState, IPluginState };

import { PluginInternalMessage, IPluginInternalMessage } from './plugin.internal.message';
export { PluginInternalMessage, IPluginInternalMessage };

import { PluginError, IPluginError } from './plugin.error';
export { PluginError, IPluginError };

import { IPluginToken, PluginToken } from './plugin.token';
export { IPluginToken, PluginToken };

import { IPluginStreamAdd, PluginStreamAdd } from './plugin.stream.add';
export { IPluginStreamAdd, PluginStreamAdd };

import { ISessionStreamState, SessionStreamState } from './session.stream.state';
export { ISessionStreamState, SessionStreamState };

// Common type for expected message implementation
export type TMessage =  PluginState |
                        PluginInternalMessage |
                        PluginError |
                        PluginToken |
                        PluginStreamAdd |
                        SessionStreamState;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
* Mapping of host/render events
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *  */
export const Map = {

    [PluginState.signature              ]: PluginState,
    [PluginInternalMessage.signature    ]: PluginInternalMessage,
    [PluginError.signature              ]: PluginError,
    [PluginToken.signature              ]: PluginToken,
    [PluginStreamAdd.signature          ]: PluginStreamAdd,
    [SessionStreamState.signature       ]: SessionStreamState,

};
