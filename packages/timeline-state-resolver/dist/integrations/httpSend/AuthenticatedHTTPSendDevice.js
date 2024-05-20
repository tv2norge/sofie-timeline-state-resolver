"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticatedHTTPSendDevice = void 0;
const _1 = require(".");
const simple_oauth2_1 = require("simple-oauth2");
const TOKEN_REQUEST_RETRY_TIMEOUT_MS = 1000;
const TOKEN_EXPIRATION_WINDOW_SEC = 60;
class AuthenticatedHTTPSendDevice extends _1.HTTPSendDevice {
    constructor() {
        super(...arguments);
        this.tokenRequestPending = false;
    }
    async init(options) {
        if (options.bearerToken) {
            this.authOptions = {
                method: 0 /* AuthMethod.BEARER_TOKEN */,
                bearerToken: options.bearerToken,
            };
        }
        else if (options.oauthClientId && options.oauthClientSecret && options.oauthTokenHost) {
            this.authOptions = {
                method: 1 /* AuthMethod.CLIENT_CREDENTIALS */,
                clientId: options.oauthClientId,
                clientSecret: options.oauthClientSecret,
                audience: options.oauthAudience,
                tokenHost: options.oauthTokenHost,
            };
            this.requestAccessToken();
        }
        // console.log('init')
        return super.init(options);
    }
    requestAccessToken() {
        // console.log('token rq')
        if (this.tokenRequestPending)
            return;
        this.clearTokenRefreshTimeout();
        this.tokenRequestPending = true;
        const promise = this.makeAccessTokenRequest();
        promise
            .then((accessToken) => {
            // console.log('token recv')
            this.emit('debug', `token received`);
            const expiresIn = accessToken.token.expires_in;
            if (typeof expiresIn === 'number') {
                this.scheduleTokenRefresh(expiresIn);
            }
        })
            .catch((e) => {
            this.emit('error', 'AuthenticatedHTTPSendDevice', e);
            setTimeout(() => this.requestAccessToken(), TOKEN_REQUEST_RETRY_TIMEOUT_MS);
        })
            .finally(() => {
            this.tokenRequestPending = false;
        });
        this.tokenPromise = promise;
    }
    clearTokenRefreshTimeout() {
        if (this.tokenRefreshTimeout) {
            clearTimeout(this.tokenRefreshTimeout);
        }
    }
    scheduleTokenRefresh(expiresInSec) {
        const timeoutMs = (expiresInSec - TOKEN_EXPIRATION_WINDOW_SEC) * 1000;
        // console.log('token refr sched')
        this.emit('debug', `token refresh scheduled in ${timeoutMs}`);
        this.tokenRefreshTimeout = setTimeout(() => this.refreshAccessToken(), timeoutMs);
    }
    refreshAccessToken() {
        this.emit('debug', `token refresh`);
        // console.log('token refr')
        this.requestAccessToken();
        this.tokenRefreshTimeout = undefined;
    }
    async makeAccessTokenRequest() {
        if (!this.authOptions || this.authOptions.method !== 1 /* AuthMethod.CLIENT_CREDENTIALS */) {
            throw Error('authOptions missing or incorrect');
        }
        this.emit('debug', 'token request');
        console.log('token request');
        const token = await new simple_oauth2_1.ClientCredentials({
            client: {
                id: this.authOptions.clientId,
                secret: this.authOptions.clientSecret,
            },
            auth: {
                tokenHost: this.authOptions.tokenHost,
            },
        }).getToken({
            audience: this.authOptions.audience,
        });
        return token;
    }
    async sendCommand({ tlObjId, context, command }) {
        // console.log('send cmd')
        if (this.authOptions) {
            const bearerToken = this.authOptions.method === 0 /* AuthMethod.BEARER_TOKEN */ ? this.authOptions.bearerToken : await this.tokenPromise;
            if (bearerToken) {
                const bearerHeader = `Bearer ${typeof bearerToken === 'string' ? bearerToken : bearerToken.token.access_token}`;
                command = {
                    ...command,
                    content: {
                        ...command.content,
                        headers: { ...command.content.headers, ['Authorization']: bearerHeader },
                    },
                };
            }
        }
        // console.log(JSON.stringify(command))
        return super.sendCommand({ tlObjId, context, command });
    }
}
exports.AuthenticatedHTTPSendDevice = AuthenticatedHTTPSendDevice;
//# sourceMappingURL=AuthenticatedHTTPSendDevice.js.map