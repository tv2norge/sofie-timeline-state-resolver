import { Conductor } from '../../../conductor'
import {
	Mappings,
	DeviceType,
	TSRTimeline,
	Mapping,
	SomeMappingSisyfos,
	TimelineContentTypeSisyfos,
	MappingSisyfosType,
} from 'timeline-state-resolver-types'
import * as OSC from '../../../__mocks__/osc'
const MockOSC = OSC.MockOSC
import { MockTime } from '../../../__tests__/mockTime'
import { ThreadedClass } from 'threadedclass'
import { SisyfosMessageDevice } from '../../../integrations/sisyfos'
import { getMockCall } from '../../../__tests__/lib'

describe('Sisyfos', () => {
	jest.mock('osc', () => OSC)
	const mockTime = new MockTime()

	const orgSetTimeout = setTimeout

	async function wait(time = 1) {
		return new Promise((resolve) => {
			orgSetTimeout(resolve, time)
		})
	}

	beforeEach(() => {
		mockTime.init()
	})

	test('Sisyfos: set ch1: pgm & ch2: lookahead and then ch1: vo, ch2: pgm (old api)', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})
		const myChannelMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 0,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping1: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping2: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping3: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			// @ts-expect-error skipping .mappingType to test backwards compatibility
			options: {
				channel: 3,
			},
		}
		const myChannelMapping: Mappings = {
			sisyfos_channel_1: myChannelMapping0,
			sisyfos_channel_2: myChannelMapping1,
			sisyfos_channel_2_lookahead: myChannelMapping2,
			sisyfos_channel_3: myChannelMapping3,
		}

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '192.168.0.10',
				port: 8900,
			},
			commandReceiver: commandReceiver0,
		})
		myConductor.setTimelineAndMappings([], myChannelMapping)
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		commandReceiver0.mockClear()

		myConductor.setTimelineAndMappings([
			{
				id: 'obj0',
				enable: {
					start: mockTime.now - 1000, // 1 seconds in the past
					duration: 2000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: 'sisyfos',

					isPgm: 1,
				},
			},
			{
				id: 'obj1',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 4000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 2,
				},
			},
			{
				id: 'obj2',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_2_lookahead',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
				isLookahead: true,
				lookaheadForLayer: 'sisyfos_channel_2',
			},
			{
				id: 'obj3',
				enable: {
					start: mockTime.now + 3000, // 3 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_2',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
			},
			{
				id: 'obj5',
				enable: {
					start: mockTime.now + 5000, // 5 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					label: 'MY TIME',
				},
			},
			{
				id: 'obj6',
				enable: {
					start: mockTime.now + 6000, // 6 seconds in the future
					duration: 900,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,
					visible: false,
				},
			},
			{
				id: 'obj7',
				enable: {
					start: mockTime.now + 7000, // 7 seconds in the future
					duration: 900,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,
					visible: true,
				},
			},
		] as TSRTimeline)

		expect(commandReceiver0.mock.calls.length).toEqual(0)
		await mockTime.advanceTimeTicks(100) // now-ish
		expect(commandReceiver0.mock.calls.length).toEqual(1)

		// set pgm
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 0,
			values: [1],
		})

		await mockTime.advanceTimeTicks(1000) // 1 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(3)
		// set VO
		expect(getMockCall(commandReceiver0, 2, 1)).toMatchObject({
			type: 'togglePst',
			channel: 1,
			value: 1,
		})

		await mockTime.advanceTimeTicks(2000) // 3 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(5)
		// set pst
		expect(getMockCall(commandReceiver0, 3, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 1,
			values: [1],
		})

		await mockTime.advanceTimeTicks(3000) // 6 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(9)
		// set pst off
		expect(getMockCall(commandReceiver0, 4, 1)).toMatchObject({
			type: 'togglePst',
			channel: 1,
			value: 0,
		})
		// set pst off
		expect(getMockCall(commandReceiver0, 5, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 0,
			values: [0],
		})
		// set new label
		expect(getMockCall(commandReceiver0, 6, 1)).toMatchObject({
			type: 'label',
			channel: 0,
			value: 'MY TIME',
		})
		// set visible false
		expect(getMockCall(commandReceiver0, 8, 1)).toMatchObject({
			type: 'visible',
			channel: 0,
			value: false,
		})
	})
	test('Sisyfos: set ch1: pgm & ch2: lookahead and then ch1: vo, ch2: pgm', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})
		const myChannelMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 0,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping1: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping2: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping3: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 3,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping: Mappings = {
			sisyfos_channel_1: myChannelMapping0,
			sisyfos_channel_2: myChannelMapping1,
			sisyfos_channel_2_lookahead: myChannelMapping2,
			sisyfos_channel_3: myChannelMapping3,
		}

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '192.168.0.10',
				port: 8900,
			},
			commandReceiver: commandReceiver0,
		})
		myConductor.setTimelineAndMappings([], myChannelMapping)
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		commandReceiver0.mockClear()

		myConductor.setTimelineAndMappings([
			{
				id: 'obj0',
				enable: {
					start: mockTime.now - 1000, // 1 seconds in the past
					duration: 2000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
			},
			{
				id: 'obj1',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 4000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 2,
				},
			},
			{
				id: 'obj2',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_2_lookahead',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
				isLookahead: true,
				lookaheadForLayer: 'sisyfos_channel_2',
			},
			{
				id: 'obj3',
				enable: {
					start: mockTime.now + 3000, // 3 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_2',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
			},
			{
				id: 'obj5',
				enable: {
					start: mockTime.now + 5000, // 5 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					label: 'MY TIME',
				},
			},
			{
				id: 'obj6',
				enable: {
					start: mockTime.now + 6000, // 6 seconds in the future
					duration: 900,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,
					visible: false,
				},
			},
			{
				id: 'obj7',
				enable: {
					start: mockTime.now + 7000, // 7 seconds in the future
					duration: 900,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,
					visible: true,
				},
			},
		])

		await mockTime.advanceTimeTicks(100) // now-ish
		expect(commandReceiver0.mock.calls.length).toEqual(1)
		// set pgm
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 0,
			values: [1],
		})

		await mockTime.advanceTimeTicks(1000) // 1 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(3)
		// set VO
		expect(getMockCall(commandReceiver0, 2, 1)).toMatchObject({
			type: 'togglePst',
			channel: 1,
			value: 1,
		})

		await mockTime.advanceTimeTicks(2000) // 3 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(5)
		// set pst
		expect(getMockCall(commandReceiver0, 3, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 1,
			values: [1],
		})

		await mockTime.advanceTimeTicks(3000) // 6 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(9)
		// set pst off
		expect(getMockCall(commandReceiver0, 4, 1)).toMatchObject({
			type: 'togglePst',
			channel: 1,
			value: 0,
		})
		// set pst off
		expect(getMockCall(commandReceiver0, 5, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 0,
			values: [0],
		})
		// set new label
		expect(getMockCall(commandReceiver0, 6, 1)).toMatchObject({
			type: 'label',
			channel: 0,
			value: 'MY TIME',
		})
		// set visible false
		expect(getMockCall(commandReceiver0, 8, 1)).toMatchObject({
			type: 'visible',
			channel: 0,
			value: false,
		})
	})

	test('Sisyfos: set lookahead and take to pgm, with lookahead still on', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})
		const myChannelMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 0,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping1: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping2: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping3: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 3,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping: Mappings = {
			sisyfos_channel_1: myChannelMapping0,
			sisyfos_channel_2: myChannelMapping1,
			sisyfos_channel_2_lookahead: myChannelMapping2,
			sisyfos_channel_3: myChannelMapping3,
		}

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '192.168.0.10',
				port: 8900,
			},
			commandReceiver: commandReceiver0,
		})
		myConductor.setTimelineAndMappings([], myChannelMapping)
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		commandReceiver0.mockClear()

		myConductor.setTimelineAndMappings([
			{
				id: 'obj0',
				enable: {
					start: mockTime.now - 1000, // 1 seconds in the past
					duration: 2000,
				},
				layer: 'sisyfos_channel_2_lookahead',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
				isLookahead: true,
				lookaheadForLayer: 'sisyfos_channel_2',
			},
			{
				id: 'obj1',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_2',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
			},
			{
				id: 'obj2',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the past
					duration: 2000,
				},
				layer: 'sisyfos_channel_2_lookahead',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 0,
				},
				isLookahead: true,
				lookaheadForLayer: 'sisyfos_channel_2',
			},
		])

		await mockTime.advanceTimeTicks(100) // now-ish
		expect(commandReceiver0.mock.calls.length).toEqual(1)
		// set pst
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'togglePst',
			channel: 1,
			value: 1,
		})

		await mockTime.advanceTimeTicks(1000) // 1 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(3)

		await mockTime.advanceTimeTicks(2000) // 3 seconds into the future
		expect(commandReceiver0.mock.calls.length).toEqual(4)

		// set pst off
		expect(getMockCall(commandReceiver0, 3, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 1,
			values: [0],
		})
	})

	test('Sisyfos: using CHANNELS', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})
		const myChannelMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channels,
			},
		}
		const myChannelMapping1: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping2: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 2,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping3: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channels,
			},
		}
		const myChannelMapping: Mappings = {
			sisyfos_channels_base: myChannelMapping0,
			sisyfos_channel_1: myChannelMapping1,
			sisyfos_channel_2: myChannelMapping2,
			sisyfos_channels: myChannelMapping3,
		}

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '192.168.0.10',
				port: 8900,
			},
			commandReceiver: commandReceiver0,
		})
		myConductor.setTimelineAndMappings([], myChannelMapping)
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		commandReceiver0.mockClear()

		myConductor.setTimelineAndMappings([
			{
				id: 'baseline',
				enable: {
					while: 1,
				},
				layer: 'sisyfos_channels_base',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNELS,

					channels: [
						{
							mappedLayer: 'sisyfos_channel_1',
							faderLevel: 0.1,
							isPgm: 0,
						},
						{
							mappedLayer: 'sisyfos_channel_2',
							faderLevel: 0.2,
							isPgm: 0,
						},
					],
					overridePriority: -999,
				},
			},
			{
				id: 'obj1',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 10000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,
					isPgm: 1,
				},
			},
			{
				id: 'obj2',
				enable: {
					start: mockTime.now + 2000, // 2 seconds in the future
					duration: 2000,
				},
				layer: 'sisyfos_channel_2',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,
					isPgm: 1,
				},
			},
			{
				id: 'obj3',
				enable: {
					start: mockTime.now + 3000, // 3 seconds in the future
					duration: 1000,
				},
				layer: 'sisyfos_channels',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNELS,

					channels: [
						{
							mappedLayer: 'sisyfos_channel_1',
							faderLevel: 0.75,
						},
						{
							mappedLayer: 'sisyfos_channel_2',
							faderLevel: 0.74,
						},
					],
					overridePriority: -999,
				},
			},
		])

		// baseline:
		await mockTime.advanceTimeTicks(100) // 100
		expect(commandReceiver0.mock.calls.length).toEqual(2)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setFader',
			channel: 1,
			value: 0.1,
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'setFader',
			channel: 2,
			value: 0.2,
		})
		commandReceiver0.mockClear()

		// obj1 has started
		await mockTime.advanceTimeTicks(1000) // 1100
		expect(commandReceiver0.mock.calls.length).toEqual(1)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 1,
			values: [1],
		})
		commandReceiver0.mockClear()

		// obj2 has started
		await mockTime.advanceTimeTicks(1000) // 2100
		expect(commandReceiver0.mock.calls.length).toEqual(1)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 2,
			values: [1],
		})
		commandReceiver0.mockClear()

		// obj3 has started
		await mockTime.advanceTimeTicks(1000) // 3100
		expect(commandReceiver0.mock.calls.length).toEqual(2)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setFader',
			channel: 1,
			value: 0.75,
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'setFader',
			channel: 2,
			value: 0.74,
		})
		commandReceiver0.mockClear()

		// obj3 & obj2 has ended
		await mockTime.advanceTimeTicks(1000) // 4100
		expect(commandReceiver0.mock.calls.length).toEqual(3)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setFader',
			channel: 1,
			value: 0.1,
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'togglePgm',
			channel: 2,
			values: [0],
		})
		expect(getMockCall(commandReceiver0, 2, 1)).toMatchObject({
			type: 'setFader',
			channel: 2,
			value: 0.2,
		})

		commandReceiver0.mockClear()
	})

	test('Sisyfos: using global triggerValue', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})
		const myChannelMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channels,
			},
		}
		const myChannelMapping1: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping2: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 2,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping3: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channels,
			},
		}
		const myTriggerMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channels,
			},
		}
		const myChannelMapping: Mappings = {
			sisyfos_channels_base: myChannelMapping0,
			sisyfos_channels_base_trigger: myTriggerMapping0,
			sisyfos_channel_1: myChannelMapping1,
			sisyfos_channel_2: myChannelMapping2,
			sisyfos_channels: myChannelMapping3,
		}

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '192.168.0.10',
				port: 8900,
			},
			commandReceiver: commandReceiver0,
		})
		myConductor.setTimelineAndMappings([], myChannelMapping)
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		commandReceiver0.mockClear()

		myConductor.setTimelineAndMappings([
			{
				id: 'baseline',
				enable: {
					while: 1,
				},
				layer: 'sisyfos_channels_base',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNELS,

					channels: [
						{
							mappedLayer: 'sisyfos_channel_1',
							faderLevel: 0.1,
							isPgm: 0,
						},
						{
							mappedLayer: 'sisyfos_channel_2',
							faderLevel: 0.2,
							isPgm: 0,
						},
					],
					overridePriority: -999,
				},
			},
			{
				id: 'baseline_trigger',
				enable: {
					while: 1,
				},
				layer: 'sisyfos_channels_base_trigger',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.TRIGGERVALUE,
					triggerValue: 'a',
				},
			},
			{
				id: 'obj1',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 10000,
				},
				layer: 'sisyfos_channel_1',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.TRIGGERVALUE,
					triggerValue: 'b',
				},
			},
			{
				id: 'obj2',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 10000,
				},
				layer: 'sisyfos_channel_2',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					isPgm: 1,
				},
			},
		])

		// baseline:
		await mockTime.advanceTimeTicks(100) // 100
		expect(commandReceiver0.mock.calls.length).toEqual(2)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 1,
			values: {
				faderLevel: 0.1,
				pgmOn: 0,
			},
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 0,
			},
		})
		commandReceiver0.mockClear()

		// obj1 has started
		await mockTime.advanceTimeTicks(1000) // 1100
		expect(commandReceiver0.mock.calls.length).toEqual(2)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 1,
			values: {
				faderLevel: 0.1,
				pgmOn: 0,
			},
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 1,
			},
		})
		commandReceiver0.mockClear()

		// back to baseline
		await mockTime.advanceTimeTicks(10000) // 11100
		expect(commandReceiver0.mock.calls.length).toEqual(2)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 1,
			values: {
				faderLevel: 0.1,
				pgmOn: 0,
			},
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 0,
			},
		})

		commandReceiver0.mockClear()
	})

	test('Sisyfos: using per-channel triggerValue - initially defined', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})
		const myChannelMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channels,
			},
		}
		const myChannelMapping1: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping2: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 2,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping: Mappings = {
			sisyfos_channels_base: myChannelMapping0,
			sisyfos_channel_1: myChannelMapping1,
			sisyfos_channel_2: myChannelMapping2,
		}

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '192.168.0.10',
				port: 8900,
			},
			commandReceiver: commandReceiver0,
		})
		myConductor.setTimelineAndMappings([], myChannelMapping)
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		commandReceiver0.mockClear()

		myConductor.setTimelineAndMappings([
			{
				id: 'baseline',
				enable: {
					while: 1,
				},
				layer: 'sisyfos_channels_base',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNELS,

					channels: [
						{
							mappedLayer: 'sisyfos_channel_1',
							faderLevel: 0.1,
							isPgm: 0,
						},
						{
							mappedLayer: 'sisyfos_channel_2',
							faderLevel: 0.2,
							isPgm: 0,
						},
					],
					overridePriority: -999,
					triggerValue: 'a',
				},
			},
			{
				id: 'obj1',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 10000,
				},
				layer: 'sisyfos_channel_2',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					triggerValue: 'b',
				},
			},
		])

		// baseline:
		await mockTime.advanceTimeTicks(100) // 100
		expect(commandReceiver0.mock.calls.length).toEqual(2)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 1,
			values: {
				faderLevel: 0.1,
				pgmOn: 0,
			},
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 0,
			},
		})
		commandReceiver0.mockClear()

		// obj1 has started
		await mockTime.advanceTimeTicks(1000) // 1100
		expect(commandReceiver0.mock.calls.length).toEqual(1)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 0,
			},
		})
		commandReceiver0.mockClear()

		// back to baseline
		await mockTime.advanceTimeTicks(10000) // 11100
		expect(commandReceiver0.mock.calls.length).toEqual(1)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 0,
			},
		})

		commandReceiver0.mockClear()
	})

	test('Sisyfos: using per-channel triggerValue - initially undefined', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})
		const myChannelMapping0: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channels,
			},
		}
		const myChannelMapping1: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 1,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping2: Mapping<SomeMappingSisyfos> = {
			device: DeviceType.SISYFOS,
			deviceId: 'mySisyfos',
			options: {
				mappingType: MappingSisyfosType.Channel,
				channel: 2,
				setLabelToLayerName: false,
			},
		}
		const myChannelMapping: Mappings = {
			sisyfos_channels_base: myChannelMapping0,
			sisyfos_channel_1: myChannelMapping1,
			sisyfos_channel_2: myChannelMapping2,
		}

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		await myConductor.init() // we cannot do an await, because setTimeout will never call without jest moving on.
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '192.168.0.10',
				port: 8900,
			},
			commandReceiver: commandReceiver0,
		})
		myConductor.setTimelineAndMappings([], myChannelMapping)
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		commandReceiver0.mockClear()

		myConductor.setTimelineAndMappings([
			{
				id: 'baseline',
				enable: {
					while: 1,
				},
				layer: 'sisyfos_channels_base',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNELS,

					channels: [
						{
							mappedLayer: 'sisyfos_channel_1',
							faderLevel: 0.1,
							isPgm: 0,
						},
						{
							mappedLayer: 'sisyfos_channel_2',
							faderLevel: 0.2,
							isPgm: 0,
						},
					],
					overridePriority: -999,
					// triggerValue: 'a'
				},
			},
			{
				id: 'obj1',
				enable: {
					start: mockTime.now + 1000, // 1 seconds in the future
					duration: 10000,
				},
				layer: 'sisyfos_channel_2',
				content: {
					deviceType: DeviceType.SISYFOS,
					type: TimelineContentTypeSisyfos.CHANNEL,

					triggerValue: 'b',
				},
			},
		])

		// baseline:
		await mockTime.advanceTimeTicks(100) // 100
		expect(commandReceiver0.mock.calls.length).toEqual(2)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 1,
			values: {
				faderLevel: 0.1,
				pgmOn: 0,
			},
		})
		expect(getMockCall(commandReceiver0, 1, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 0,
			},
		})
		commandReceiver0.mockClear()

		// obj1 has started
		await mockTime.advanceTimeTicks(1000) // 1100
		expect(commandReceiver0.mock.calls.length).toEqual(1)
		expect(getMockCall(commandReceiver0, 0, 1)).toMatchObject({
			type: 'setChannel',
			channel: 2,
			values: {
				faderLevel: 0.2,
				pgmOn: 0,
			},
		})
		commandReceiver0.mockClear()

		// back to baseline
		await mockTime.advanceTimeTicks(10000) // 11100
		expect(commandReceiver0.mock.calls.length).toEqual(0)

		commandReceiver0.mockClear()
	})

	test('Connection status', async () => {
		const commandReceiver0: any = jest.fn(async () => {
			return Promise.resolve()
		})

		const myConductor = new Conductor({
			multiThreadedResolver: false,
			getCurrentTime: mockTime.getCurrentTime,
		})
		// myConductor.setTimelineAndMappings([], myChannelMapping)
		await myConductor.init()
		await myConductor.addDevice('mySisyfos', {
			type: DeviceType.SISYFOS,
			options: {
				host: '127.0.0.1',
				port: 1234,
			},
			commandReceiver: commandReceiver0,
		})
		await mockTime.advanceTimeToTicks(10100)

		const deviceContainer = myConductor.getDevice('mySisyfos')
		const device = deviceContainer!.device as ThreadedClass<SisyfosMessageDevice>

		const onConnectionChanged = jest.fn()
		await device.on('connectionChanged', onConnectionChanged)

		// Check that no commands has been scheduled:
		expect(await device.queue).toHaveLength(0)
		expect(await device.connected).toEqual(true)
		expect(onConnectionChanged).toHaveBeenCalledTimes(0)

		// Simulate a connection loss:
		MockOSC.connectionIsGood = false

		await mockTime.advanceTimeTicks(3000)
		await wait(1)
		await mockTime.advanceTimeTicks(3000)
		await wait(1)

		expect(await device.connected).toEqual(false)
		expect(onConnectionChanged).toHaveBeenCalledTimes(1)

		// Simulate a connection regain:
		MockOSC.connectionIsGood = true
		await mockTime.advanceTimeTicks(3000)
		await wait(1)
		await mockTime.advanceTimeTicks(3000)
		await wait(1)

		expect(await device.connected).toEqual(true)
		expect(onConnectionChanged).toHaveBeenCalledTimes(4)
	})
})
