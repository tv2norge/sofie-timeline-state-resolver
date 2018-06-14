import { TriggerType } from 'superfly-timeline'

import { Mappings, MappingLawo, DeviceType } from '../devices/mapping'
import { Conductor } from '../conductor'
import { LawoDevice, TimelineContentTypeLawo } from '../devices/lawo'

let now: number = 1000

beforeAll(() => {
	Date.now = jest.fn()
	Date.now['mockReturnValue'](1000)
})
function getCurrentTime () {
	return now
}

function advanceTime (advanceTime: number) {
	now += advanceTime
	jest.advanceTimersByTime(advanceTime)
}

test('Lawo: add channel', async () => {
	jest.useFakeTimers()

	let commandReceiver0 = jest.fn(() => {
		// nothing.
	})
	let myChannelMapping0: MappingLawo = {
		device: DeviceType.LAWO,
		deviceId: 'myLawo',
		path: [1, 1, 2, 3],
		defaults: {
			'Motor dB Value': -191
		}
	}
	let myChannelMapping: Mappings = {
		'lawo_c1_fader': myChannelMapping0
	}

	let myConductor = new Conductor({
		// devices: {
		// 	'myLawo': {
		// 		type: DeviceType.LAWO,
		// 		host: '160.67.96.51',
		// 		port: 9000,
		// 		options: {
		// 			commandReceiver: commandReceiver0
		// 		}
		// 	} as DeviceOptions
		// },
		initializeAsClear: true,
		getCurrentTime: getCurrentTime
	})
	myConductor.mapping = myChannelMapping
	await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
	await myConductor.addDevice('myLawo', {
		type: DeviceType.LAWO,
		options: {
			host: '160.67.96.51',
			port: 9000,
			commandReceiver: commandReceiver0
		}
	})
	advanceTime(100) // 1100

	let device = myConductor.getDevice('myLawo') as LawoDevice

	// Check that no commands has been scheduled:
	expect(device.queue).toHaveLength(0)
	myConductor.timeline = [
		{
			id: 'obj0',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: now - 1000 // 1 seconds in the past
			},
			duration: 2000,
			LLayer: 'lawo_c1_fader',
			content: {
				type: TimelineContentTypeLawo.LAWO,
				attributes: {
					'Motor dB Value': -6
				}
			}
		},
		{
			id: 'obj1',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: now + 500 // 0.5 seconds in the future
			},
			duration: 2000,
			LLayer: 'lawo_c1_fader',
			content: {
				type: TimelineContentTypeLawo.LAWO,
				attributes: {
					'Motor dB Value': -4
				}
			}
		}
	]

	advanceTime(100) // 1200

	expect(commandReceiver0).toHaveBeenCalledTimes(1)
	expect(commandReceiver0.mock.calls[0][1]).toMatchObject(
		{
			attribute: 'Motor dB Value',
			value: -6,
			path: '1/1/2/3'
		}
	)

	advanceTime(800) // 2000

	expect(commandReceiver0).toHaveBeenCalledTimes(2)
	expect(commandReceiver0.mock.calls[1][1]).toMatchObject(
		{
			attribute: 'Motor dB Value',
			value: -4,
			path: '1/1/2/3'
		}
	)

	advanceTime(2000) // 4000
	expect(commandReceiver0).toHaveBeenCalledTimes(3)
	expect(commandReceiver0.mock.calls[2][1]).toMatchObject(
		{
			attribute: 'Motor dB Value',
			value: -191,
			path: '1/1/2/3'
		}
	)
})

test('Lawo: change volume', async () => {
	now = 1000
	jest.useFakeTimers()

	let commandReceiver0 = jest.fn(() => {
		// nothing.
	})
	let myChannelMapping0: MappingLawo = {
		device: DeviceType.LAWO,
		deviceId: 'myLawo',
		path: [1, 1, 2, 3],
		defaults: {
			'Motor dB Value': -191
		}
	}
	let myChannelMapping: Mappings = {
		'lawo_c1_fader': myChannelMapping0
	}

	let myConductor = new Conductor({
		initializeAsClear: true,
		getCurrentTime: getCurrentTime
	})
	myConductor.mapping = myChannelMapping
	await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
	await myConductor.addDevice('myLawo', {
		type: DeviceType.LAWO,
		options: {
			host: '160.67.96.51',
			port: 9000,
			commandReceiver: commandReceiver0
		}
	})
	advanceTime(100) // 1100

	let device = myConductor.getDevice('myLawo') as LawoDevice

	// Check that no commands has been scheduled:
	expect(device.queue).toHaveLength(0)
	myConductor.timeline = [
		{
			id: 'obj0',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: now - 1000 // 1 seconds in the future
			},
			duration: 2000,
			LLayer: 'lawo_c1_fader',
			content: {
				type: TimelineContentTypeLawo.LAWO,
				attributes: {
					'Motor dB Value': 0 // 0 dBFS
				}
			}
		}
	]

	advanceTime(100)
	myConductor.timeline = [
		{
			id: 'obj0',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: now - 1000 // 1 seconds in the future
			},
			duration: 2000,
			LLayer: 'lawo_c1_fader',
			content: {
				type: TimelineContentTypeLawo.LAWO,
				attributes: {
					'Motor dB Value': -15 // -15 dBFS
				}
			}
		}
	]
	advanceTime(100)
	expect(commandReceiver0.mock.calls[1][1]).toMatchObject(
		{
			path: '1/1/2/3',
			attribute: 'Motor dB Value',
			value: -15
		}
	)
})
