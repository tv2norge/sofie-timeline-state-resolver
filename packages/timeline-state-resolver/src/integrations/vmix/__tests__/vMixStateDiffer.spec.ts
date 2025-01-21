import { VMixCommand } from 'timeline-state-resolver-types'
import { VMixStateDiffer } from '../vMixStateDiffer'
import { makeMockFullState } from './mockState'

function createTestee(): VMixStateDiffer {
	return new VMixStateDiffer(jest.fn())
}

/**
 * Note: most of the coverage is still in vmix.spec.ts
 */
describe('VMixStateDiffer', () => {
	it('does not generate commands for identical states', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		expect(differ.getCommandsToAchieveState(oldState, newState)).toEqual([])
	})

	it('resets audio buses when audio starts to be controlled', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		newState.reportedState.existingInputsAudio['99'] = differ.getDefaultInputAudioState(99)

		const commands = differ.getCommandsToAchieveState(oldState, newState)
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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

	it('sets browser url', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		const url = 'https://example.com'
		newState.reportedState.existingInputs['99'].url = url

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.BROWSER_NAVIGATE,
			input: '99',
			value: url,
		})
	})

	it('sets index', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		const index = 3
		newState.reportedState.existingInputs['99'].index = index

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SELECT_INDEX,
			input: '99',
			value: index,
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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

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

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_TEXT,
			input: '99',
			value: '',
			fieldName: 'myTitle.Text',
		})
	})

	it('sets images', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'].images = {
			'myImage.Source': 'image.png',
		}

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_IMAGE,
			input: '99',
			value: 'image.png',
			fieldName: 'myImage.Source',
		})
	})

	it('sets multiple images', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)

		newState.reportedState.existingInputs['99'].images = {
			'myImage1.Source': 'foo.png',
			'myImage2.Source': 'bar.jpg',
		}

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(2)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_IMAGE,
			input: '99',
			value: 'foo.png',
			fieldName: 'myImage1.Source',
		})
		expect(commands[1].command).toMatchObject({
			command: VMixCommand.SET_IMAGE,
			input: '99',
			value: 'bar.jpg',
			fieldName: 'myImage2.Source',
		})
	})

	it('does not unset image', () => {
		// it would have to be explicitly set to an empty string on the timeline
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].images = {
			'myImage1.Source': 'foo.png',
			'myImage2.Source': 'bar.jpg',
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].images = {
			'myImage2.Source': 'bar.jpg',
		}

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(0)
	})

	it('updates image', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].images = {
			'myImage1.Source': 'foo.png',
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].images = {
			'myImage1.Source': 'bar.jpg',
		}

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_IMAGE,
			input: '99',
			value: 'bar.jpg',
			fieldName: 'myImage1.Source',
		})
	})

	it('updates image to an empty one', () => {
		const differ = createTestee()

		const oldState = makeMockFullState()
		const newState = makeMockFullState()

		oldState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		oldState.reportedState.existingInputs['99'].images = {
			'myImage1.Source': 'foo.png',
		}

		newState.reportedState.existingInputs['99'] = differ.getDefaultInputState(99)
		newState.reportedState.existingInputs['99'].images = {
			'myImage1.Source': '',
		}

		const commands = differ.getCommandsToAchieveState(oldState, newState)

		expect(commands.length).toBe(1)
		expect(commands[0].command).toMatchObject({
			command: VMixCommand.SET_IMAGE,
			input: '99',
			value: '',
			fieldName: 'myImage1.Source',
		})
	})
})
