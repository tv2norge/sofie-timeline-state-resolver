import { ViscaCommand } from '../abstractCommand'

export class ZoomDirectCommand extends ViscaCommand {
	constructor(private readonly position: number) {
		super()
	}

	serialize() {
		const buffer = Buffer.alloc(4)
		const positionPadded = this.toIntWithZeroes(this.position)
		buffer.writeUInt32BE(positionPadded)

		return Buffer.from([0x81, 0x01, 0x04, 0x47, ...buffer, 0xff])
	}
}
