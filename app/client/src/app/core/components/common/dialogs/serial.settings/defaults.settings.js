"use strict";
var DefaultsPortSettings = (function () {
    function DefaultsPortSettings() {
        this.lock = true;
        this.baudRate = 921600;
        this.dataBits = 8;
        this.stopBits = 1;
        this.rtscts = false;
        this.xon = false;
        this.xoff = false;
        this.xany = false;
        this.bufferSize = 65536;
        this.vmin = 1;
        this.vtime = 0;
        this.vtransmit = 50;
    }
    return DefaultsPortSettings;
}());
exports.DefaultsPortSettings = DefaultsPortSettings;
//# sourceMappingURL=defaults.settings.js.map