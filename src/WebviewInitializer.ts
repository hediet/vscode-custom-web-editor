import { Webview } from "vscode";
import { EventEmitter } from "@hediet/std/events";

interface CustomWebviewConfig {
	editorUrl: string;
}

export class WebviewInitializer {
	public setupWebview(
		config: CustomWebviewConfig,
		webview: Webview
	): CustomEditorBridge {
		webview.options = { enableScripts: true };
		webview.html = `
        <html>
        <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline'; worker-src * data: 'unsafe-inline' 'unsafe-eval'; font-src * 'unsafe-inline' 'unsafe-eval';">
        <style>
            html { height: 100%; width: 100%; padding: 0; margin: 0; }
            body { height: 100%; width: 100%; padding: 0; margin: 0; }
            iframe { height: 100%; width: 100%; padding: 0; margin: 0; border: 0; display: block; }
        </style>
        </head>
        <body>
            <script>
                const api = window.VsCodeApi = acquireVsCodeApi();
                window.addEventListener('message', event => {
                    if (event.source === window.frames[0]) {
                        console.log("frame -> vscode", event.data);
                        api.postMessage(event.data);
                    } else {
                        console.log("vscode -> frame", event.data);
                        window.frames[0].postMessage(event.data, "*");
                    }
                });
            </script>
            <iframe src="${config.editorUrl}"></iframe>
        </body>
    </html>
        `;

		const c = new CustomEditorBridge(webview);
		return c;
	}
}

class CustomEditorBridge {
	private readonly changeEmitter = new EventEmitter<{
		newContent: JsonValue;
	}>();
	public readonly onChange = this.changeEmitter.asEvent();

	private readonly initEmitter = new EventEmitter<{}>();
	public readonly onInit = this.initEmitter.asEvent();

	constructor(private readonly webview: Webview) {
		webview.onDidReceiveMessage((msg: MesssageToHost) => {
			if (msg.kind === "onInit") {
				this.initEmitter.emit({});
			} else if (msg.kind === "onChange") {
				this.changeEmitter.emit({ newContent: msg.newContent });
			}
		});
	}

	private sendMessage(message: MessageFromHost) {
		this.webview.postMessage(message);
	}

	public setContent(content: JsonValue): void {
		this.sendMessage({ kind: "loadContent", content });
	}
}

type JsonValue = unknown;

type MessageFromHost = {
	kind: "loadContent";
	content: JsonValue;
};

type MesssageToHost =
	| { kind: "onInit" }
	| {
			kind: "onChange";
			newContent: JsonValue;
	  };
