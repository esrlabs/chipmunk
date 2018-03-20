
module.exports = {
    emitter : new (require('events').EventEmitter)(),
    EVENTS  : {
        'SEND_VIA_WS'               : Symbol(),
        'CLIENT_IS_DISCONNECTED'    : Symbol(),
        'WRITE_TO_SERIAL'           : Symbol(),
        'WRITE_TO_TELNET'           : Symbol()
    }
}