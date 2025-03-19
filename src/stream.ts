export class LineByLineStream extends TransformStream<string, string> {
	constructor() {
		let buffer = "";

		super({
			transform(chunk, controller) {
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) {
					controller.enqueue(line);
				}
			},
			flush(controller) {
				if (buffer.length > 0) controller.enqueue(buffer);
			},
		});
	}
}

export class JsonDecoderStream<T = unknown> extends TransformStream<string, T> {
	constructor() {
		super({
			transform(chunk, controller) {
				const message = JSON.parse(chunk);
				controller.enqueue(message);
			},
		});
	}
}

export class EventStream extends TransformStream<
	string,
	[name: string, data: string]
> {
	constructor() {
		let buffer = "";
		let currentEventName = "";
		let currentEventData = "";

		super({
			transform(chunk, controller) {
				buffer += chunk;

				// Process lines in the buffer
				let start = 0;
				while (true) {
					const newlineIndex = buffer.indexOf("\n", start);
					if (newlineIndex === -1) break;

					// Extract one line (without the trailing newline)
					const line = buffer.slice(start, newlineIndex).trimEnd();
					start = newlineIndex + 1;

					if (!line) {
						// If we hit a blank line, that’s the end of one SSE event
						if (currentEventData) {
							controller.enqueue([
								currentEventName || "message",
								currentEventData,
							]);
						}
						currentEventName = "";
						currentEventData = "";
					} else if (line.startsWith("event:")) {
						// event: ...
						currentEventName = line.slice(6).trim();
					} else if (line.startsWith("data:")) {
						// data: ...
						const dataPart = line.slice(5).trim();
						if (currentEventData) {
							// Append to existing data (SSE can have multiple "data:" lines)
							currentEventData += `\n${dataPart}`;
						} else {
							currentEventData = dataPart;
						}
					}
					// Other fields (id:, retry:) can be handled similarly if needed
				}

				// Preserve the remainder of the buffer for the next transform call
				buffer = buffer.slice(start);
			},

			flush(controller) {
				// If there’s leftover data that wasn’t terminated by an empty line
				if (currentEventData) {
					controller.enqueue([currentEventName || "message", currentEventData]);
				}
			},
		});
	}
}
