import { HostState, EHostState, IHostState } from './plugin.state';
export { HostState, EHostState, IHostState };

// Common type for expected message implementation
export type TMessage =  HostState;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
* Mapping of host/render events
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *  */
export const Map = {

    [HostState.signature            ]: HostState,

};
