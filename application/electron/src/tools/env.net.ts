import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as fs from 'fs';

import ServiceNetwork from '../services/service.network';
import ServiceEnv from '../services/service.env';

import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

function getProxyURI(uri: url.URL): string | undefined {
    const proxy = ServiceNetwork.getSettings().proxy;
    if (proxy === 'string' && proxy.trim() !== '') {
        return proxy;
    }
    const env = ServiceEnv.getOS();
	if (uri.protocol === 'http:') {
		return env.HTTP_PROXY || env.http_proxy || undefined;
	} else if (uri.protocol === 'https:') {
		return env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || undefined;
	}
	return undefined;
}

export interface IOptions {
	proxyUrl?: string;
	strictSSL?: boolean;
}

export function getProxyAgent(uri: url.URL): http.Agent | https.Agent | undefined {
    const strictSSL = ServiceNetwork.getSettings().strictSSL;
	const proxyURL: string | undefined = getProxyURI(uri);
	if (!proxyURL) {
		return undefined;
	}
	const link = new url.URL(proxyURL);
	if (!/^https?:$/.test(link.protocol || '')) {
		return undefined;
	}
	const opts = {
		host: link.hostname || '',
		port: link.port || (link.protocol === 'https' ? '443' : '80'),
		auth: (link.username !== '' && link.password !== '') ? `${link.username}:${link.password}` : '',
		rejectUnauthorized: typeof strictSSL === 'boolean' ? strictSSL : true,
	};
	return uri.protocol === 'http:' ? new HttpProxyAgent(opts) : new HttpsProxyAgent(opts);
}

export function getRequestOptions(uri: url.URL, type: string = 'GET', headers: { [key: string]: string } = {}): http.RequestOptions {
    const settings = {
        password: '',
        user: '',
    };
    // TODO: Include into settings
    const auth = ServiceNetwork.getSettings().auth;
    return {
        agent: getProxyAgent(uri),
        headers: (typeof auth === 'string' && auth.trim() !== '') ? {
            ...headers,
            'Proxy-Authorization': auth
        } : headers,
        hostname: uri.hostname,
        port: uri.port ? parseInt(uri.port, 10) : (uri.protocol === 'https:' ? 443 : 80),
        protocol: uri.protocol,
        // path: uri.pathname,
        method: type || 'GET',
        auth: (typeof settings.password === 'string' && typeof settings.user === 'string' && settings.password.trim() !== '' && settings.user.trim() !== '') ?
            `${settings.user}:${settings.password}` : undefined,
    };
}

type TFileName = string;

export function download(uri: string, filename: TFileName): Promise<TFileName> {
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

export function getRaw(uri: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const link = new url.URL(uri);
        if (link.protocol === undefined || link.protocol === null) {
            return reject(new Error(`Not valid url: ${uri}`));
        }
        const protocol = link.protocol.slice(0, -1);
        const transport = {
            http: http,
            https: https,
        };
        (transport as any)[protocol]
            .get(uri, getRequestOptions(link), (response: http.IncomingMessage) => {
                if (
                    response.statusCode !== undefined &&
                    response.statusCode >= 200 &&
                    response.statusCode < 300
                ) {
                    response.setEncoding('utf8');
                    let raw = '';
                    response.on('data', (chunk) => { raw += chunk; });
                    response.on('end', () => {
                        resolve(raw);
                    });
                } else {
                    reject(new Error(response.statusCode + ' ' + response.statusMessage));
                }
            })
            .on('error', (requestErr: NodeJS.ErrnoException) => {
                reject(requestErr);
            });
    });
}
