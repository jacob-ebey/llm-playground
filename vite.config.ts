import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
	server: {
		host: "127.0.0.1",
	},
	plugins: [tailwindcss(), viteSingleFile()],
});
