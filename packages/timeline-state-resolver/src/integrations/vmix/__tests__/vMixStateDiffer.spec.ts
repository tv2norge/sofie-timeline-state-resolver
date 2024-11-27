import { VMixCommand } from 'timeline-state-resolver-types'
import { VMixStateDiffer } from '../vMixStateDiffer'
import { makeMockFullState } from './mockState'

function createTestee(): VMixStateDiffer {
	return new VMixStateDiffer(() => Date.now(), jest.fn())
}

/**
 * Note: most of the coverage is still in vmix.spec.ts
 */
describe('VMixStateDiffer', () => {
	it('does not generate commands for identical states', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		expect(differ.getCommandsToAchieveState(Date.now(), oldState, newState)).toEqual([])
	})

	it('resets audio buses when audio starts to be controlled', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		newState.reportedState.existingInputsAudio['99'] = differ.getDefaultInputAudioState(99)

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)
		const busCommands = commands.filter((command) => command.command.command === VMixCommand.AUDIO_BUS_OFF)

		expect(busCommands.length).toBe(7) // all but Master
	})

	it('sets layer input when it starts to be controlled', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].layers = {
			2: {
				input: 5,
			},
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({ command: VMixCommand.SET_LAYER_INPUT, value: 5, index: 2 })
	})

	it('sets layer zoom', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].layers = {
			2: {
				input: 5,
			},
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].layers = {
			2: {
				input: 5,
				zoom: 1.5,
			},
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({ command: VMixCommand.SET_LAYER_ZOOM, value: 1.5, index: 2 })
	})

	it('sets layer pan', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].layers = {
			2: {
				input: 5,
			},
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].layers = {
			2: {
				input: 5,
				panX: -1,
				panY: 2,
			},
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(2)
		expect(commands[0].command).toMatchObject({ command: VMixCommand.SET_LAYER_PAN_X, value: -1, index: 2 })
		expect(commands[1].command).toMatchObject({ command: VMixCommand.SET_LAYER_PAN_Y, value: 2, index: 2 })
	})

	it('sets layer crop', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].layers = {
			2: {
				input: 5,
			},
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].layers = {
			2: {
				input: 5,
				cropLeft: 0.2,
				cropRight: 0.7,
				cropTop: 0.1,
				cropBottom: 0.8,
			},
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_LAYER_CROP,
			index: 2,
			cropLeft: 0.2,
			cropRight: 0.7,
			cropTop: 0.1,
			cropBottom: 0.8,
		})
	})

	it('sets text', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'].text = {
			'myTitle.Text': 'SomeValue',
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_TEXT,
			input: '99',
			value: 'SomeValue',
			fieldName: 'myTitle.Text',
		})
	})

	it('sets multiple texts', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'].text = {
			'myTitle.Text': 'SomeValue',
			'myTitle.Foo': 'Bar',
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(2)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_TEXT,
			input: '99',
			value: 'SomeValue',
			fieldName: 'myTitle.Text',
		})
		expect(commands[1].command).toMatchObject({
			command: VMixCommand.SET_TEXT,
			input: '99',
			value: 'Bar',
			fieldName: 'myTitle.Foo',
		})
	})

	it('does not unset text', () => {
		// it would have to be explicitly set to an empty string on the timeline
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].text = {
			'myTitle.Text': 'SomeValue',
			'myTitle.Foo': 'Bar',
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].text = {
			'myTitle.Foo': 'Bar',
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(0)
	})

	it('updates text', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].text = {
			'myTitle.Text': 'SomeValue',
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].text = {
			'myTitle.Text': 'Bar',
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_TEXT,
			input: '99',
			value: 'Bar',
			fieldName: 'myTitle.Text',
		})
	})

	it('updates text to an empty string', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].text = {
			'myTitle.Text': 'SomeValue',
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].text = {
			'myTitle.Text': '',
		}

		const commands = differ.getCommandsToAchieveState(Date.now(), oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_TEXT,
			input: '99',
			value: '',
			fieldName: 'myTitle.Text',
		})
	})
})
