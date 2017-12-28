
export class DefaultsPortSettings {
    lock           : boolean       = true;
    baudRate       : number        = 921600;
    dataBits       : number        = 8;
    stopBits       : number        = 1;
    rtscts         : boolean       = false;
    xon            : boolean       = false;
    xoff           : boolean       = false;
    xany           : boolean       = false;
    bufferSize     : number        = 65536;
    vmin           : number        = 1;
    vtime          : number        = 0;
    vtransmit      : number        = 50;
}
