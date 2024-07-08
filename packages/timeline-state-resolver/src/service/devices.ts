import { OscDevice } from '../integrations/osc'
import { DeviceType } from 'timeline-state-resolver-types'
import { Device } from './device'
import { AuthenticatedHTTPSendDevice } from '../integrations/httpSend/AuthenticatedHTTPSendDevice'
import { ViscaOverIpDevice } from '../integrations/viscaOverIP'

export interface DeviceEntry {
	deviceClass: new () => Device<any, any, any>
	canConnect: boolean
	deviceName: (deviceId: string, options: any) => string
	executionMode: (options: any) => 'salvo' | 'sequential'
}

type ImplementedDeviceTypes = DeviceType.OSC | DeviceType.HTTPSEND | DeviceType.VISCA_OVER_IP

// TODO - move all device implementations here and remove the old Device classes
export const DevicesDict: Record<ImplementedDeviceTypes, DeviceEntry> = {
	[DeviceType.OSC]: {
		deviceClass: OscDevice,
		canConnect: true,
		deviceName: (deviceId: string) => 'OSC ' + deviceId,
		executionMode: () => 'salvo',
	},
	[DeviceType.HTTPSEND]: {
		deviceClass: AuthenticatedHTTPSendDevice,
		canConnect: false,
		deviceName: (deviceId: string) => 'HTTPSend ' + deviceId,
		executionMode: () => 'sequential', // todo - config?
	},
	[DeviceType.VISCA_OVER_IP]: {
		deviceClass: ViscaOverIpDevice,
		canConnect: false,
		deviceName: (deviceId: string) => 'VISCAOverIP ' + deviceId,
		executionMode: () => 'sequential', // todo - config?
	},
}
