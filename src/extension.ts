import { window, ExtensionContext } from "vscode";
import { Disposable } from "@hediet/std/disposable";
import {
	enableHotReload,
	hotRequireExportedFn,
	registerUpdateReconciler,
	getReloadCount,
} from "@hediet/node-reload";

if (process.env.HOT_RELOAD) {
	enableHotReload({ entryModule: module, loggingEnabled: true });
}

registerUpdateReconciler(module);

import { TextEditorProvider } from "./TextEditorProvider";
import { WebviewInitializer } from "./WebviewInitializer";

export class Extension {
	public readonly dispose = Disposable.fn();

	private readonly webviewInitializer = new WebviewInitializer();

	constructor() {
		if (getReloadCount(module) > 0) {
			const i = this.dispose.track(window.createStatusBarItem());
			i.text = "reload-" + getReloadCount(module);
			i.show();
		}

		this.dispose.track(
			window.registerCustomEditorProvider(
				"hediet.custom-web-editor",
				new TextEditorProvider(this.webviewInitializer),
				{
					supportsMultipleEditorsPerDocument: true,
					webviewOptions: { retainContextWhenHidden: true },
				}
			)
		);
	}
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		hotRequireExportedFn(module, Extension, (Extension) => new Extension())
	);
}

export function deactivate() {}
