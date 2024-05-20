"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteDeviceInstance = exports.BaseRemoteDeviceIntegration = void 0;
const threadedclass_1 = require("threadedclass");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const eventemitter3_1 = require("eventemitter3");
class BaseRemoteDeviceIntegration extends eventemitter3_1.EventEmitter {
    constructor(deviceOptions, threadConfig) {
        super();
        this._details = {
            deviceId: 'N/A',
            deviceType: timeline_state_resolver_types_1.DeviceType.ABSTRACT,
            deviceName: 'N/A',
            instanceId: -1,
            startTime: -1,
            supportsExpectedPlayoutItems: false,
            canConnect: true,
        };
        this._onEventListeners = [];
        this._debugLogging = true;
        this._debugState = false;
        this._initialized = false;
        this._deviceOptions = deviceOptions;
        this._threadConfig = threadConfig;
        this._debugLogging = deviceOptions.debug || false;
    }
    get initialized() {
        return this._initialized;
    }
    async terminate() {
        this._onEventListeners.forEach((listener) => listener.stop());
        await threadedclass_1.ThreadedClassManager.destroy(this._device);
    }
    async setDebugLogging(debug) {
        this._debugLogging = debug;
        await this._device.setDebugLogging(debug);
    }
    async setDebugState(debug) {
        this._debugState = debug;
        await this._device.setDebugState(debug);
    }
    get device() {
        return this._device;
    }
    get deviceId() {
        return this._details.deviceId;
    }
    get deviceType() {
        return this._details.deviceType;
    }
    get deviceName() {
        return this._details.deviceName;
    }
    get deviceOptions() {
        return this._deviceOptions;
    }
    get threadConfig() {
        return this._threadConfig;
    }
    get instanceId() {
        return this._details.instanceId;
    }
    get startTime() {
        return this._details.startTime;
    }
    get debugLogging() {
        return this._debugLogging;
    }
    get debugState() {
        return this._debugState;
    }
    get details() {
        return this._details;
    }
}
exports.BaseRemoteDeviceIntegration = BaseRemoteDeviceIntegration;
/**
 * A device container is a wrapper around a device in ThreadedClass class, it
 * keeps a local property of some basic information about the device (like
 * names and id's) to prevent a costly round trip over IPC.
 */
class RemoteDeviceInstance extends BaseRemoteDeviceIntegration {
    constructor(deviceOptions, threadConfig) {
        super(deviceOptions, threadConfig);
    }
    static async create(orgModule, orgClassExport, deviceId, deviceOptions, getCurrentTime, threadConfig) {
        if (process.env.JEST_WORKER_ID !== undefined && threadConfig && threadConfig.disableMultithreading) {
            // running in Jest test environment.
            // hack: we need to work around the mangling performed by threadedClass, as getCurrentTime needs to not return a promise
            getCurrentTime = { inner: getCurrentTime };
        }
        const container = new RemoteDeviceInstance(deviceOptions, threadConfig);
        container._device = await (0, threadedclass_1.threadedClass)(orgModule, orgClassExport, [deviceId, getCurrentTime(), deviceOptions, getCurrentTime], // TODO types
        threadConfig);
        try {
            if (deviceOptions.isMultiThreaded) {
                container._onEventListeners = [
                    threadedclass_1.ThreadedClassManager.onEvent(container._device, 'thread_closed', () => {
                        // This is called if a child crashes
                        if (container.onChildClose)
                            container.onChildClose();
                    }),
                    threadedclass_1.ThreadedClassManager.onEvent(container._device, 'error', (error) => {
                        container.emit('error', `${orgClassExport} "${deviceId}" threadedClass error`, error);
                    }),
                ];
            }
            await container.reloadProps();
            return container;
        }
        catch (e) {
            // try to clean up any loose threads
            container.terminate().catch(() => null);
            throw e;
        }
    }
    async reloadProps() {
        const props = await this._device.getDetails();
        this._details.canConnect = props.canConnect;
        this._details.supportsExpectedPlayoutItems = props.supportsExpectedPlayoutItems;
        this._details.deviceId = props.deviceId;
        this._details.deviceType = props.deviceType;
        this._details.deviceName = props.deviceName;
        this._details.instanceId = props.instanceId;
        this._details.startTime = props.startTime;
    }
    async init(_initOptions, activeRundownPlaylistId) {
        if (this.initialized) {
            throw new Error(`Device ${this.deviceId} is already initialized`);
        }
        const res = await this._device.initDevice(activeRundownPlaylistId);
        this._initialized = true;
        return res;
    }
}
exports.RemoteDeviceInstance = RemoteDeviceInstance;
//# sourceMappingURL=remoteDeviceInstance.js.map