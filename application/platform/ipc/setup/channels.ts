export const RENDER_EVENT_NAME = 'render_event';
export const RENDER_REQUEST_NAME = 'render_request';
export const RENDER_RESPONSE_NAME = 'render_response';

export const HOST_EVENT_NAME = 'host_event';
export const HOST_REQUEST_NAME = 'host_request';
export const HOST_RESPONSE_NAME = 'host_response';

export const ERROR_FIELD = '__e';
export const CODE_FIELD = '__c';
export const PAYLOAD_FIELD = '__p';
export const SEQUENCE_FIELD = '__s';

export const CODES: {
    unknown: number;
    done: number;
    error: number;
    aborted: number;
} = {
    unknown: -1,
    done: 0,
    error: 1,
    aborted: 2,
};
