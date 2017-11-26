const SETTINGS = require('./config.js');

let Server = require('./libs/server.js'),
    server = new Server();

server.create();




/*
let Serial = require('./libs/service.serial.js'),
    serial = new Serial();

serial.getListPorts();
serial.open();
    */