import {
	OLLAMA_BASE_URL_DEFAULT,
	OPENAI_BASE_URL_DEFAULT,
} from "./constants.ts";
import { EventStream, JsonDecoderStream, LineByLineStream } from "./stream.ts";

export type Provider = "ollama" | "openai";

export type Message = {
	role: string;
	content: string;
};

export type LLMOptions = {
	provider: Provider;
	model: string;
	messages: Message[];
	signal?: AbortSignal;
};

export type CallLLMOptions = LLMOptions & OllamaOptions & OpenAIOptions;

export type OllamaOptions = {
	ollama: {
		baseURL?: string | null;
	};
};

export type OpenAIOptions = {
	openai: {
		apiKey?: string | null;
		baseURL?: string | null;
	};
};

export async function callLLM(options: CallLLMOptions) {
	switch (options.provider) {
		case "ollama":
			return callOllama(options);
		case "openai":
			return callOpenAI(options);
		default:
			throw new Error(`Unknown provider: ${(options as LLMOptions).provider}`);
	}
}

async function* callOllama({
	messages,
	model,
	signal,
	ollama: { baseURL },
}: LLMOptions & OllamaOptions): AsyncGenerator<string> {
	const url = joinURL(baseURL || OLLAMA_BASE_URL_DEFAULT, "api/chat");

	const response = await fetch(url, {
		method: "POST",
		body: JSON.stringify({
			model,
			messages,
		}),
		signal,
	});

	if (!response.body) {
		throw new Error("Response body is null");
	}

	const chunks = response.body
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(new LineByLineStream())
		.pipeThrough(new JsonDecoderStream<OllamaMessageChunk>());

	for await (const chunk of streamToGenerator(chunks)) {
		if (chunk.done) continue;
		if (chunk.message.content) {
			yield chunk.message.content;
		}
	}
}

async function* callOpenAI({
	messages,
	model,
	openai: { apiKey, baseURL },
}: LLMOptions & OpenAIOptions): AsyncGenerator<string> {
	const url = joinURL(baseURL || OPENAI_BASE_URL_DEFAULT, "chat/completions");

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

	if (!response.body) {
		throw new Error("Response body is null");
	}

	const chunks = response.body
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(new EventStream());

	for await (const [, data] of streamToGenerator(chunks)) {
		if (data === "[DONE]") continue;
		const chunk = JSON.parse(data);
		const content = chunk?.choices?.[0]?.delta?.content;
		if (content) {
			yield content;
		}
	}
}

function joinURL(baseURL: string, path: string) {
	const url = new URL(baseURL);
	if (!url.pathname.endsWith("/")) {
		url.pathname += "/";
	}
	url.pathname += path;
	return url.href;
}

async function* streamToGenerator<T>(
	stream: ReadableStream<T>,
): AsyncGenerator<T> {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

type OllamaMessageChunk = {
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
