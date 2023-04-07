import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as fs from 'fs';

import { Transform } from 'stream';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Module } from './module';
import { version } from '@module/version';
import { error } from 'platform/log/utils';
import { settings } from '@service/settings';
import { envvars } from '@loader/envvars';
import { unique } from 'platform/env/sequence';

const PROXY = { key: 'proxy', path: 'general.network' };
const AUTHORIZATION = { key: 'authorization', path: 'general.network' };
const STRICTSSL = { key: 'strictSSL', path: 'general.network' };
const USER_AGENT_HEADER = 'User-Agent';

export class Net extends Module {
    public getName(): string {
        return 'Net';
    }

    public getUserAgent(): string {
        return `Chipmunk@${version.getVersion()}`;
    }

    public getURL(uri: string): url.URL | Error {
        try {
            return new url.URL(uri);
        } catch (err) {
            return new Error(`Fail to parse ${uri} due error: ${error(err)}`);
        }
    }

    public getProxyURI(uri: url.URL): string | undefined {
        const proxy = settings.get().value(PROXY.path, PROXY.key);
        if (typeof proxy === 'string' && proxy.trim() !== '') {
            return proxy;
        }
        const env = envvars.getOS();
        if (uri.protocol === 'http:') {
            return env['HTTP_PROXY'] || env['http_proxy'] || undefined;
        } else if (uri.protocol === 'https:') {
            return (
                env['HTTPS_PROXY'] ||
                env['https_proxy'] ||
                env['HTTP_PROXY'] ||
                env['http_proxy'] ||
                undefined
            );
        }
        return undefined;
    }

    public getProxyAgent(uri: url.URL): http.Agent | https.Agent | undefined {
        const strictSSL = settings.get().value(STRICTSSL.path, STRICTSSL.key);
        const proxyURL: string | undefined = this.getProxyURI(uri);
        if (!proxyURL) {
            return undefined;
        }
        const link: url.URL | Error = this.getURL(proxyURL);
        if (link instanceof Error) {
            this.logger.warn(link.message);
            return undefined;
        }
        if (!/^https?:$/.test(link.protocol || '')) {
            return undefined;
        }
        const opts = {
            host: link.hostname || '',
            port: link.port || (link.protocol === 'https' ? '443' : '80'),
            auth:
                link.username !== '' && link.password !== ''
                    ? `${link.username}:${link.password}`
                    : '',
            rejectUnauthorized: typeof strictSSL === 'boolean' ? strictSSL : true,
        };
        return uri.protocol === 'http:' ? new HttpProxyAgent(opts) : new HttpsProxyAgent(opts);
    }

    public getRequestOptions(
        uri: url.URL,
        type = 'GET',
        headers: { [key: string]: string } = {},
    ): http.RequestOptions {
        const config = {
            password: '',
            user: '',
        };
        // TODO: Include into settings
        const auth = settings.get().value(AUTHORIZATION.path, AUTHORIZATION.key);
        if (headers[USER_AGENT_HEADER] === undefined) {
            headers[USER_AGENT_HEADER] = this.getUserAgent();
        }
        return {
            agent: this.getProxyAgent(uri),
            headers:
                typeof auth === 'string' && auth.trim() !== ''
                    ? {
                          ...headers,
                          'Proxy-Authorization': auth,
                      }
                    : headers,
            hostname: uri.hostname,
            port: uri.port ? parseInt(uri.port, 10) : uri.protocol === 'https:' ? 443 : 80,
            protocol: uri.protocol,
            // path: uri.pathname,
            method: type || 'GET',
            auth:
                typeof config.password === 'string' &&
                typeof config.user === 'string' &&
                config.password.trim() !== '' &&
                config.user.trim() !== ''
                    ? `${config.user}:${config.password}`
                    : undefined,
        };
    }

    public download(uri: string, filename: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const link: url.URL | Error = this.getURL(uri);
            if (link instanceof Error) {
                return reject(
                    new Error(this.logger.warn(`Fail to parse ${uri} due error: ${link.message}`)),
                );
            }
            if (link.protocol === undefined || link.protocol === null) {
                return reject(new Error(`Not valid url: ${uri}`));
            }
            const protocol = link.protocol.slice(0, -1);
            const transport: { [key: string]: typeof http | typeof https } = {
                http: http,
                https: https,
            };
            const opt = this.getRequestOptions(link);
            transport[protocol]
                .get(uri, opt, (response: http.IncomingMessage) => {
                    if (
                        response.statusCode !== undefined &&
                        response.statusCode >= 200 &&
                        response.statusCode < 300
                    ) {
                        const requestUuid = unique();
                        this.logger.debug(`Successfully requested (${requestUuid}): ${uri}`);
                        const writer = fs.createWriteStream(filename);
                        writer.on('error', (saveErr: NodeJS.ErrnoException) => {
                            fs.unlink(filename, () => {
                                reject(saveErr);
                            });
                        });
                        writer.on('close', () => {
                            this.logger.debug(`Successfully download from ${uri} to ${filename}`);
                            resolve(filename);
                        });
                        let received = 0;
                        let prev = Date.now();
                        const logger = this.logger;
                        response
                            .pipe(
                                new Transform({
                                    transform(
                                        chunk: string | Buffer,
                                        _encoding: BufferEncoding,
                                        callback: () => void,
                                    ) {
                                        received += chunk.length;
                                        this.push(chunk);
                                        callback();
                                        const current = Date.now();
                                        if (current - prev > 3000) {
                                            logger.debug(
                                                `Downloaded (${requestUuid}): ${received} bytes`,
                                            );
                                            prev = Date.now();
                                        }
                                    },
                                }),
                            )
                            .pipe(writer);
                    } else if (response.headers.location) {
                        this.download(response.headers.location, filename)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        reject(
                            new Error(
                                this.logger.warn(
                                    `Fail to connect to ${uri}: code = ${
                                        response.statusCode
                                    }; status: ${response.statusMessage}; proxy usage: ${
                                        opt.agent !== undefined
                                    }.`,
                                ),
                            ),
                        );
                    }
                })
                .on('error', (requestErr: NodeJS.ErrnoException) => {
                    fs.unlink(filename, () => {
                        reject(requestErr);
                    });
                });
        });
    }

    public getRaw(uri: string, headers: { [key: string]: string } = {}): Promise<string> {
        return new Promise((resolve, reject) => {
            const link: url.URL | Error = this.getURL(uri);
            if (link instanceof Error) {
                return reject(
                    new Error(this.logger.warn(`Fail to parse ${uri} due error: ${link.message}`)),
                );
            }
            if (link.protocol === undefined || link.protocol === null) {
                return reject(new Error(`Not valid url: ${uri}`));
            }
            const protocol = link.protocol.slice(0, -1);
            const transport: { [key: string]: typeof http | typeof https } = {
                http: http,
                https: https,
            };
            const opt = this.getRequestOptions(link, 'GET', headers);
            transport[protocol]
                .get(uri, opt, (response: http.IncomingMessage) => {
                    if (
                        response.statusCode !== undefined &&
                        response.statusCode >= 200 &&
                        response.statusCode < 300
                    ) {
                        this.logger.debug(`Successfully requested: ${uri}`);
                        response.setEncoding('utf8');
                        let raw = '';
                        response.on('data', (chunk) => {
                            raw += chunk;
                        });
                        response.on('end', () => {
                            this.logger.debug(
                                `Successfully received from ${uri} ${raw.length} bytes`,
                            );
                            resolve(raw);
                        });
                    } else if (response.headers.location) {
                        this.getRaw(response.headers.location).then(resolve).catch(reject);
                    } else {
                        reject(
                            new Error(
                                this.logger.warn(
                                    `Fail to connect to ${uri}: code = ${
                                        response.statusCode
                                    }; status: ${response.statusMessage}; proxy usage: ${
                                        opt.agent !== undefined
                                    }.`,
                                ),
                            ),
                        );
                    }
                })
                .on('error', (requestErr: NodeJS.ErrnoException) => {
                    reject(requestErr);
                });
        });
    }
}

export const net: Net = new Net();
