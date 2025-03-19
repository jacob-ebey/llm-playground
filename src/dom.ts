export function createTextStreamTarget(element: HTMLElement) {
	let buffer = "";
	const flushBuffer = () => {
		if (buffer.length > 0) {
			element.innerText += buffer;
			buffer = "";
		}
	};

	return (chunk: string) => {
		buffer += chunk;
		requestAnimationFrame(flushBuffer);
	};
}
