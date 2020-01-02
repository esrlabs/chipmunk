import ServicePorts from './services/service.ports';

const CPortA = '/dev/TESTPORTA';
const CPortB = '/dev/TESTPORTB'

function createPort(name: string) {
    // Create test port
    ServicePorts.create(name);
    // Connect to port
    ServicePorts.refPort(
        '*',
        { 
            path: name,
            options: {
                lock: false,
            },
            reader: {
                delimiter: '\n'
            },
        },
        {
            onData: (chunk: Buffer) => {},
            onError: (error: Error) => {},
            onDisconnect: () => {}
        }
    ).then(() => {
        const write = () => {
            ServicePorts.write(name, `${Math.random()}-${Math.random()}-${Math.random()}\n${Math.random()}-${Math.random()}-${Math.random()}\n`)
            .then(() => setTimeout(write, 100 + Math.random() * 500))
            .catch((error: Error) => { console.log(`Fail to send message due to error: ${error.message}`) });
        }
        write();
    }).catch((error: Error) => {
        console.log(`Fail to create test port "${name}" due error: ${error.message}`);
    });
}

export function test() {
    // createPort(CPortA);
    // createPort(CPortB);
}
