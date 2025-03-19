import { createTextStreamTarget } from "./dom.ts";
import { type Message, type Provider, callLLM } from "./llm.ts";

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
		option.value = `ollama:${model.name}`;
		option.textContent = `ollama:${model.name}`;
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
		option.value = `openai:${model.id}`;
		option.textContent = `openai:${model.id}`;
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
			const idNode = clone.querySelector("[data-id]") as HTMLElement;
			idNode.textContent = id;
			const previewNode = clone.querySelector("[data-preview]") as HTMLElement;
			previewNode.innerHTML =
				localStorage.getItem(`content-${id}`)?.slice(0, 100) || "";
			const inputNode = clone.querySelector("[data-input]") as
				| HTMLInputElement
				| HTMLButtonElement;
			inputNode.value = id;
			const form = clone.querySelector("form") as HTMLFormElement;
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
	if (event.submitter?.dataset.discard) {
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

	const streamText = createTextStreamTarget(responseElement);

	try {
		const modelSelection = modelSelect.value || modelSelect.options[0].value;
		const [provider, ...nameParts] = modelSelection.split(":") as [
			Provider,
			...string[],
		];
		const model = nameParts.join(":");

		const chunks = await callLLM({
			messages,
			model,
			provider,
			signal: sendController.signal,
			ollama: {
				baseURL: localStorage.getItem("setting-ollama-base-url"),
			},
			openai: {
				apiKey: localStorage.getItem("setting-openai-auth-token"),
				baseURL: localStorage.getItem("setting-openai-base-url"),
			},
		});

		for await (const chunk of chunks) {
			streamText(chunk);
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
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	const sel = window.getSelection();
	if (sel) {
		sel.removeAllRanges();
		sel.addRange(range);
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
