import {
	TextDocument,
	WebviewPanel,
	CancellationToken,
	workspace,
	WorkspaceEdit,
	Range,
	CustomTextEditorProvider,
} from "vscode";
import { WebviewInitializer } from "./WebviewInitializer";

interface EditableDocument {
	"x-editable"?: {
		kind: string;
		defaultUrl: string;
	};
}

export class TextEditorProvider implements CustomTextEditorProvider {
	constructor(private readonly webviewInitializer: WebviewInitializer) {}

	public async resolveCustomTextEditor(
		document: TextDocument,
		webviewPanel: WebviewPanel,
		token: CancellationToken
	): Promise<void> {
		let isThisEditorSaving = false;

		const text = document.getText();
		const doc = JSON.parse(text) as EditableDocument;
		const args = doc["x-editable"];
		if (!args) {
			throw new Error("invalid json document!");
		}

		const bridge = this.webviewInitializer.setupWebview(
			{ editorUrl: args.defaultUrl },
			webviewPanel.webview
		);

		const setContentFromDocument = () => {
			const newText = document.getText();
			const content = JSON.parse(newText);
			bridge.setContent(content);
		};

		workspace.onDidChangeTextDocument(async (evt) => {
			if (evt.document !== document) {
				return;
			}
			if (isThisEditorSaving) {
				// We don't want to integrate our own changes
				return;
			}
			if (evt.contentChanges.length === 0) {
				// Sometimes VS Code reports a document change without a change.
				return;
			}

			setContentFromDocument();
		});

		bridge.onChange.sub(async ({ newContent }) => {
			const workspaceEdit = new WorkspaceEdit();

			const output = JSON.stringify(newContent, undefined, 4);
			workspaceEdit.replace(
				document.uri,
				new Range(0, 0, document.lineCount, 0),
				output
			);

			isThisEditorSaving = true;
			try {
				await workspace.applyEdit(workspaceEdit);
			} finally {
				isThisEditorSaving = false;
			}
		});

		bridge.onInit.sub(() => {
			setContentFromDocument();
		});
	}
}
