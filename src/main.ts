const refreshButton = document.getElementById(
	"btn-refresh",
) as HTMLButtonElement;
const modelSelect = document.getElementById(
	"model-select",
) as HTMLSelectElement;
const newButton = document.getElementById("btn-new") as HTMLButtonElement;
const sendButton = document.getElementById("btn-send") as HTMLButtonElement;
const saveButton = document.getElementById("btn-save") as HTMLButtonElement;
const saveAsButton = document.getElementById(
	"btn-save-as",
) as HTMLButtonElement;
const settingsButton = document.getElementById(
	"btn-settings",
) as HTMLButtonElement;
const settingsDialog = document.getElementById(
	"dialog-settings",
) as HTMLDialogElement;
const settingsForm = document.getElementById(
	"settings-form",
) as HTMLFormElement;
const historyButton = document.getElementById(
	"btn-history",
) as HTMLButtonElement;
const historyDialog = document.getElementById(
	"dialog-history",
) as HTMLDialogElement;
const historyForm = document.getElementById("history-form") as HTMLFormElement;
const historyList = document.getElementById("history-list") as HTMLUListElement;
const historyTemplate = document.getElementById(
	"history-item-template",
) as HTMLTemplateElement;
const contentElement = document.getElementById("content") as HTMLDivElement &
	ElementContentEditable;

let initializeAbortController = new AbortController();

async function initializeOllama() {
	const url = new URL(
		localStorage.getItem("setting-ollama-base-url") || "http://localhost:11434",
	);
	url.pathname += "api/tags";
	const tagsResponse = await fetch(url, {
		signal: initializeAbortController.signal,
	});
	const tags = await tagsResponse.json();
	modelSelect.innerHTML = "";
	for (const model of tags.models) {
		const option = document.createElement("option");
		option.value = "ollama:" + model.name;
		option.textContent = "ollama:" + model.name;
		modelSelect.appendChild(option);
	}

	const selectedModel = window.localStorage.getItem("active-model");
	modelSelect.value = selectedModel || modelSelect.value;
}

async function initializeOpenAI() {
	const apiKey = localStorage.getItem("setting-openai-auth-token") || "";
	let baseURL =
		localStorage.getItem("setting-openai-base-url") ||
		"https://api.openai.com/v1/";
	if (!baseURL.endsWith("/")) {
		baseURL += "/";
	}
	const url = new URL(baseURL);
	url.pathname += "models";
	const response = await fetch(url, {
		headers: {
			Authorization: apiKey ? `Bearer ${apiKey}` : "",
			"Content-Type": "application/json",
		},
	});
	const models = await response.json();
	for (const model of models.data) {
		const option = document.createElement("option");
		option.value = "openai:" + model.id;
		option.textContent = "openai:" + model.id;
		modelSelect.appendChild(option);
	}

	const selectedModel = window.localStorage.getItem("active-model");
	modelSelect.value = selectedModel || modelSelect.value;
}

function initializeContent() {
	let content = window.localStorage.getItem("content") || "";
	const id = window.location.hash.replace(/^#/, "").trim();
	if (id) {
		const specificContent = window.localStorage.getItem(`content-${id}`);
		if (specificContent) {
			content = specificContent;
		}
	}
	contentElement.innerHTML = content;
}

function initializeHistory() {
	historyList.innerHTML = "";
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith("content-")) {
			const id = key.slice(8);
			const clone = document
				.importNode(historyTemplate.content, true)
				.querySelector("li") as HTMLLIElement;
			const anchor = clone.querySelector("a") as HTMLAnchorElement;
			anchor.href = `/#${id}`;
			const idNode = clone.querySelector("[data-id]")!;
			idNode.textContent = id;
			const previewNode = clone.querySelector("[data-preview]")!;
			previewNode.innerHTML =
				localStorage.getItem(`content-${id}`)?.slice(0, 100) || "";
			const inputNode = clone.querySelector("[data-input]")! as
				| HTMLInputElement
				| HTMLButtonElement;
			inputNode.value = id;
			const form = clone.querySelector("form")! as HTMLFormElement;
			form.addEventListener("submit", async (event) => {
				event.preventDefault();
				localStorage.removeItem(`content-${id}`);
				historyList.removeChild(clone);
			});
			historyList.appendChild(clone);
		}
	}
}

async function initializeOptions() {
	initializeContent();
	initializeHistory();

	keepScrolledToBottom(contentElement);

	initializeAbortController.abort();
	initializeAbortController = new AbortController();

	modelSelect.innerHTML = "";
	await initializeOllama().catch(console.error);
	await initializeOpenAI().catch(console.error);
}

modelSelect.addEventListener("input", () => {
	window.localStorage.setItem("active-model", modelSelect.value);
});

const debouncedPersistActiveContentForRecall = debounce(
	persistActiveContentForRecall,
);
contentElement.addEventListener("input", () => {
	debouncedPersistActiveContentForRecall();
});

saveButton.addEventListener("click", () => {
	const id =
		window.location.hash.replace(/^#/, "").trim() || crypto.randomUUID();
	saveActiveContentAs(id);
});

saveAsButton.addEventListener("click", () => {
	const id = crypto.randomUUID();
	saveActiveContentAs(id);
});

refreshButton.addEventListener("click", () => {
	initializeOptions();
});

sendButton.addEventListener("click", () => {
	sendMessage();
});

settingsButton.addEventListener("click", () => {
	viewTransition(() => {
		settingsForm["setting-ollama-base-url"].value =
			localStorage.getItem("setting-ollama-base-url") || "";
		settingsForm["setting-openai-base-url"].value =
			localStorage.getItem("setting-openai-base-url") || "";
		settingsForm["setting-openai-auth-token"].value =
			localStorage.getItem("setting-openai-auth-token") || "";
		settingsDialog.showModal();
	});
});

newButton.addEventListener("click", () => {
	history.replaceState(null, "", "/");
	viewTransition(() => {
		contentElement.innerHTML = "";
		persistActiveContentForRecall();
		placeCaretAtEnd(contentElement);
	});
});

historyButton.addEventListener("click", () => {
	initializeHistory();
	viewTransition(() => {
		historyDialog.showModal();
	});
});

historyForm.addEventListener("submit", (event) => {
	viewTransition(() => {
		historyDialog.close();
	});
	event.preventDefault();
});

settingsForm.addEventListener("submit", (event) => {
	if (Boolean(event.submitter?.dataset.discard)) {
		viewTransition(() => {
			settingsDialog.close();
		});
		event.preventDefault();
		return;
	}
	const ollamaBaseURL = settingsForm["setting-ollama-base-url"].value;
	localStorage.setItem("setting-ollama-base-url", ollamaBaseURL);

	const openaiBaseURL = settingsForm["setting-openai-base-url"].value;
	localStorage.setItem("setting-openai-base-url", openaiBaseURL);

	const openaiToken = settingsForm["setting-openai-auth-token"].value;
	localStorage.setItem("setting-openai-auth-token", openaiToken);

	initializeOptions();

	viewTransition(() => {
		settingsDialog.close();
	});
	event.preventDefault();
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && event.ctrlKey) {
		sendMessage();
		return event.preventDefault();
	}

	if (event.key === "Escape") {
		if (settingsDialog.open) {
			viewTransition(() => {
				settingsDialog.close();
			});
		} else if (historyDialog.open) {
			viewTransition(() => {
				historyDialog.close();
			});
		} else {
			abortMessage();
		}
		return event.preventDefault();
	}
});

// window.history.pushState = new Proxy(window.history.pushState, {
// 	apply: () => {
// 		// trigger here what you need
// 		initializeContent();
// 	},
// });
addEventListener("hashchange", () => {
	initializeContent();
	if (historyDialog.open) {
		viewTransition(() => {
			historyDialog.close();
		});
	}
});

initializeOptions();

let sendController = new AbortController();
function abortMessage() {
	sendController.abort();
	sendController = new AbortController();
}

type Message = {
	role: string;
	content: string;
};

type MessageChunk = {
	created_at: string;
	message: {
		content: string;
		role: string;
		tool_calls?: {
			function: {
				name: string;
				arguments: Record<string, unknown>;
			};
		}[];
	};
	model: string;
} & (
	| {
			done: false;
	  }
	| {
			done: true;
			done_reason: string;
			eval_count: number;
			eval_duration: number;
			load_duration: number;
			prompt_eval_count: number;
			prompt_eval_duration: number;
			total_duration: number;
	  }
);

const loadingClasses = [
	"loading",
	"after:inline-block",
	"after:animate-spin",
	"after:content-['↻']",
];

async function sendMessage() {
	const messages = parseMessages(contentElement.innerText ?? "");
	if (!messages.length) return;

	const assistantNode = newTextNode("Assistant:");
	const responseElement = newTextNode();
	viewTransition(() => {
		contentElement.appendChild(newBreakNode());
		assistantNode.classList.add(...loadingClasses);
		contentElement.appendChild(assistantNode);
		contentElement.appendChild(responseElement);
		contentElement.appendChild(newBreakNode());
		contentElement.appendChild(newTextNode("User:"));
		contentElement.appendChild(newBreakNode());
		if (document.activeElement === contentElement) {
			placeCaretAtEnd(contentElement);
		}
	});

	try {
		const modelSelection = modelSelect.value || modelSelect.options[0].value;
		const [provider, ...nameParts] = modelSelection.split(":");
		const model = nameParts.join(":");

		if (provider === "ollama") {
			const url = new URL(
				localStorage.getItem("setting-ollama-base-url") ||
					"http://localhost:11434",
			);
			url.pathname += "api/chat";
			const response = await fetch(url, {
				method: "POST",
				body: JSON.stringify({
					model,
					messages,
				}),
				signal: sendController.signal,
			});

			const chunks = response
				.body!.pipeThrough(new TextDecoderStream())
				.pipeThrough(new LineByLineStream())
				.pipeThrough(new JsonDecoderStream<MessageChunk>());

			const reader = chunks.getReader();
			let buffer = "";
			let lastFlushTime = 0;

			const flushBuffer = () => {
				if (buffer !== "") {
					responseElement.innerText += buffer;
					buffer = "";
					lastFlushTime = performance.now();
				}
			};

			const tryFlushBuffer = () => {
				const now = performance.now();
				const timeSinceLastFlush = now - lastFlushTime;
				if (timeSinceLastFlush > 1000 / 30) {
					// 30fps max
					flushBuffer();
				}
			};

			try {
				for (;;) {
					const { value, done } = await reader.read();
					if (done || value.done) {
						break;
					}
					buffer += value.message.content;
					requestAnimationFrame(tryFlushBuffer);
				}
			} finally {
				reader.releaseLock();
				// Ensure any remaining buffer is flushed
				flushBuffer();
			}
		} else if (provider === "openai") {
			const apiKey = localStorage.getItem("setting-openai-auth-token") || "";
			let baseURL =
				localStorage.getItem("setting-openai-base-url") ||
				"https://api.openai.com/v1/";
			if (!baseURL.endsWith("/")) {
				baseURL += "/";
			}
			const url = new URL(baseURL);
			url.pathname += "chat/completions";
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: apiKey ? `Bearer ${apiKey}` : "",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model,
					messages,
					stream: true,
				}),
			});
			const chunks = response
				.body!.pipeThrough(new TextDecoderStream())
				.pipeThrough(new EventStream());

			const reader = chunks.getReader();
			let buffer = "";
			let lastFlushTime = 0;

			const flushBuffer = () => {
				if (buffer !== "") {
					responseElement.innerText += buffer;
					buffer = "";
					lastFlushTime = performance.now();
				}
			};

			const tryFlushBuffer = () => {
				const now = performance.now();
				const timeSinceLastFlush = now - lastFlushTime;
				if (timeSinceLastFlush > 1000 / 30) {
					// 30fps max
					flushBuffer();
				}
			};

			try {
				for (;;) {
					const {
						value: [, data] = [, ""],
						done,
					} = await reader.read();
					if (done || data === "[DONE]") {
						break;
					}
					const chunk = JSON.parse(data);
					const content = chunk?.choices?.[0]?.delta?.content;
					if (typeof content === "string") {
						buffer += content;
						requestAnimationFrame(tryFlushBuffer);
					}
				}
			} finally {
				reader.releaseLock();
				// Ensure any remaining buffer is flushed
				flushBuffer();
			}
		} else {
			throw new Error("Unsupported provider");
		}
	} finally {
		assistantNode.classList.remove(...loadingClasses);
		persistActiveContentForRecall();
	}
}

function saveActiveContentAs(id: string) {
	const clone = contentElement.cloneNode(true) as HTMLElement;
	for (const node of clone.querySelectorAll(".loading")) {
		node.classList.remove(...loadingClasses);
	}
	const content = clone.innerHTML ?? "";
	if (!content.trim()) {
		return;
	}
	window.localStorage.setItem(`content-${id}`, content);
	history.pushState(null, "", `/#${id}`);
	initializeHistory();
}

function persistActiveContentForRecall() {
	const id = window.location.hash.replace(/^#/, "").trim();
	const clone = contentElement.cloneNode(true) as HTMLElement;
	for (const node of clone.querySelectorAll(".loading")) {
		node.classList.remove(...loadingClasses);
	}
	const content = clone.innerHTML ?? "";
	window.localStorage.setItem(id ? `content-${id}` : "content", content);
}

function parseMessages(input: string): Message[] {
	const lines = input.split(/\r?\n/);
	const messages: Message[] = [];

	let currentRole = "user";
	let currentContent = "";

	for (const line of lines) {
		const userMatch = line.match(/^user:\s*(.*)/i);
		const assistantMatch = line.match(/^assistant:\s*(.*)/i);
		const systemMatch = line.match(/^system:\s*(.*)/i);

		if (userMatch) {
			if (currentContent.trim()) {
				messages.push({ role: currentRole, content: currentContent.trim() });
			}
			currentRole = "user";
			currentContent = userMatch[1] || "";
		} else if (assistantMatch) {
			if (currentContent.trim()) {
				messages.push({ role: currentRole, content: currentContent.trim() });
			}
			currentRole = "assistant";
			currentContent = assistantMatch[1] || "";
		} else if (systemMatch) {
			if (currentContent.trim()) {
				messages.push({ role: currentRole, content: currentContent.trim() });
			}
			currentRole = "system";
			currentContent = systemMatch[1] || "";
		} else {
			currentContent += `\n${line}`;
		}
	}

	if (currentContent.trim()) {
		messages.push({ role: currentRole, content: currentContent.trim() });
	}

	return messages;
}

function newBreakNode() {
	const node = document.createElement("div");
	node.appendChild(document.createElement("br"));
	return node;
}

function newTextNode(text = "") {
	const node = document.createElement("div");
	node.innerText = text;
	return node;
}

function placeCaretAtEnd(el: HTMLElement) {
	el.focus();
	var range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	var sel = window.getSelection();
	if (sel) {
		sel.removeAllRanges();
		sel.addRange(range);
	}
}

class LineByLineStream extends TransformStream<string, string> {
	constructor() {
		let buffer = "";

		super({
			transform(chunk, controller) {
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				lines.forEach((line) => controller.enqueue(line));
			},
			flush(controller) {
				if (buffer.length > 0) controller.enqueue(buffer);
			},
		});
	}
}

class JsonDecoderStream<T = unknown> extends TransformStream<string, T> {
	constructor() {
		super({
			transform(chunk, controller) {
				try {
					const message = JSON.parse(chunk);
					controller.enqueue(message);
				} catch (error) {
					console.error("Failed to parse JSON:", error);
				}
			},
		});
	}
}

class EventStream extends TransformStream<
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
							currentEventData += "\n" + dataPart;
						} else {
							currentEventData = dataPart;
						}
					}
					// Other fields (id:, retry:) can be handled similarly if needed
				}

				// Preserve the remainder of the buffer for the next transform call
				buffer = buffer.slice(start);
			},

			flush: (controller) => {
				// If there’s leftover data that wasn’t terminated by an empty line
				if (currentEventData) {
					controller.enqueue([currentEventName || "message", currentEventData]);
				}
			},
		});
	}
}

function keepScrolledToBottom(element: HTMLElement): void {
	if (element.getAttribute("data-autoscroll")) {
		return;
	}

	// Check if the element has overflow-y: auto or similar
	const style = window.getComputedStyle(element);
	if (style.overflowY !== "auto" && style.overflowY !== "scroll") {
		console.warn(
			"Element does not have overflow-y: auto or scroll. Auto-scrolling will not work.",
		);
		return;
	}

	element.setAttribute("data-autoscroll", "true");

	let autoScrollEnabled = true;
	let maxScroll = element.scrollHeight - element.clientHeight;

	const mutationObserver = new MutationObserver(() => {
		if (!autoScrollEnabled) {
			return; // Don't auto-scroll if disabled
		}

		// Check if we were at the bottom before the mutation
		const wasAtBottom = element.scrollTop >= maxScroll;

		// Update maxScroll after the mutation (important for dynamic content)
		maxScroll = element.scrollHeight - element.clientHeight;

		if (wasAtBottom) {
			// Scroll to the bottom after the mutation
			setTimeout(() => {
				// Use setTimeout to ensure the DOM has updated
				element.scrollTop = maxScroll;
			}, 0);
		}
	});

	const scrollListener = () => {
		if (element.scrollTop < maxScroll) {
			autoScrollEnabled = false;
		} else {
			autoScrollEnabled = true;
		}
	};

	// Start observing the element
	mutationObserver.observe(element, {
		childList: true,
		characterData: true,
		subtree: true,
	});

	// Add scroll event listener
	element.addEventListener("scroll", scrollListener);

	// Initial scroll to bottom
	setTimeout(() => {
		element.scrollTop = maxScroll;
	}, 0);
}

function viewTransition(cb: () => void) {
	if (document.startViewTransition) {
		document.startViewTransition(cb);
	} else {
		cb();
	}
}

function debounce(func: () => void, delay = 300) {
	let timeoutId: number | null = null;
	return () => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(func, delay);
	};
}
