"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceContainer = void 0;
const threadedclass_1 = require("threadedclass");
const remoteDeviceInstance_1 = require("../service/remoteDeviceInstance");
/**
 * A device container is a wrapper around a device in ThreadedClass class, it
 * keeps a local property of some basic information about the device (like
 * names and id's) to prevent a costly round trip over IPC.
 */
class DeviceContainer extends remoteDeviceInstance_1.BaseRemoteDeviceIntegration {
    constructor(deviceOptions, threadConfig) {
        super(deviceOptions, threadConfig);
    }
    static async create(orgModule, orgClassExport, deviceId, deviceOptions, getCurrentTime, threadConfig) {
        if (process.env.JEST_WORKER_ID !== undefined && threadConfig && threadConfig.disableMultithreading) {
            // running in Jest test environment.
            // hack: we need to work around the mangling performed by threadedClass, as getCurrentTime needs to not return a promise
            getCurrentTime = { inner: getCurrentTime };
        }
        const container = new DeviceContainer(deviceOptions, threadConfig);
        container._device = await (0, threadedclass_1.threadedClass)(orgModule, orgClassExport, [deviceId, deviceOptions, getCurrentTime], // TODO types
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
        this._details.deviceId = await this._device.deviceId;
        this._details.deviceType = await this._device.deviceType;
        this._details.deviceName = await this._device.deviceName;
        this._details.instanceId = await this._device.instanceId;
        this._details.startTime = await this._device.startTime;
        this._details.canConnect = await this._device.canConnect;
        this._details.supportsExpectedPlayoutItems = await this._device.supportsExpectedPlayoutItems;
    }
    async init(initOptions, activeRundownPlaylistId) {
        if (this.initialized) {
            throw new Error(`Device ${this.deviceId} is already initialized`);
        }
        const res = await this._device.init(initOptions, activeRundownPlaylistId);
        this._initialized = true;
        return res;
    }
}
exports.DeviceContainer = DeviceContainer;
//# sourceMappingURL=deviceContainer.js.map