
import * as SerialPort from 'serialport';

export function getListOfPorts(){
    return SerialPort.list();
}

/*
export function getListOfPorts(): Promise<Array<any>>{
    return new Promise((resolve: Function) =>{
        resolve(['11111', '2222222']);
    });
}
*/