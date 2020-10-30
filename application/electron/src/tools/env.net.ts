import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as fs from 'fs';

export function download(uri: string, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const _url = url.parse(uri);
        if (_url === undefined || _url.protocol === undefined || _url.protocol === null) {
            return reject(new Error(`Not valid url: ${uri}`));
        }
        const protocol = _url.protocol.slice(0, -1);
        const transport = {
            http: http,
            https: https,
        };
        (transport as any)[protocol]
            .get(uri, (response: http.IncomingMessage) => {
                if (
                    response.statusCode !== undefined &&
                    response.statusCode >= 200 &&
                    response.statusCode < 300
                ) {
                    const writer = fs.createWriteStream(filename);
                    writer.on('error', (saveErr: NodeJS.ErrnoException) => {
                        fs.unlink(filename, (err: NodeJS.ErrnoException | null) => {
                            reject(saveErr);
                        });
                    });
                    writer.on('close', () => {
                        resolve(filename);
                    });
                    response.pipe(writer);
                } else if (response.headers.location) {
                    download(response.headers.location, filename)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new Error(response.statusCode + ' ' + response.statusMessage));
                }
            })
            .on('error', (requestErr: NodeJS.ErrnoException) => {
                fs.unlink(filename, (err: NodeJS.ErrnoException | null) => {
                    reject(requestErr);
                });
            });
    });
}
