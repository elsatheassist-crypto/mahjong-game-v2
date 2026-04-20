import { useCallback, useEffect, useRef, useState } from "react";
import { callLLM } from "../ai/llm/providers";
import type {
	AIDifficulty,
	AIMode,
	AssistMode,
	HumanAiMode,
	HybridConfig,
	TileSize,
} from "../stores/gameStore";
import { useGameStore } from "../stores/gameStore";
import type { LLMConfigDraft, SettingsDraft, TestStatus } from "./GameSettings";
import GameSettings from "./GameSettings";

interface SettingsModalProps {
	open: boolean;
	onClose: () => void;
	difficulty: AIDifficulty;
	aiMode: AIMode;
	llmConfig: LLMConfigDraft | null;
	hybridConfig: HybridConfig;
	tileSize: TileSize;
	assistMode: AssistMode;
	humanAiMode: HumanAiMode;
	autoPlayDelay: number;
}

function createDraftFromProps(
	props: Pick<
		SettingsModalProps,
		| "difficulty"
		| "aiMode"
		| "llmConfig"
		| "hybridConfig"
		| "tileSize"
		| "assistMode"
		| "humanAiMode"
		| "autoPlayDelay"
	>,
): SettingsDraft {
	return {
		difficulty: props.difficulty,
		aiMode: props.aiMode,
		hybridConfig: props.hybridConfig,
		tileSize: props.tileSize,
		assistMode: props.assistMode,
		humanAiMode: props.humanAiMode,
		autoPlayDelay: props.autoPlayDelay,
		llmConfig: props.llmConfig ?? {
			provider: "openrouter",
			apiKey: "",
			model: "google/gemini-2.0-flash-exp",
		},
	};
}

const SettingsModal = (props: SettingsModalProps) => {
	const {
		open,
		onClose,
		difficulty,
		aiMode,
		llmConfig,
		hybridConfig,
		tileSize,
		assistMode,
		humanAiMode,
		autoPlayDelay,
	} = props;
	const {
		setDifficulty,
		setAIMode,
		setHybridConfig,
		setTileSize,
		setHumanAiMode,
		setAutoPlayDelay,
		setLLMConfig,
		setAssistMode,
	} = useGameStore();

	const currentDraft = createDraftFromProps({
		difficulty,
		aiMode,
		llmConfig,
		hybridConfig,
		tileSize,
		assistMode,
		humanAiMode,
		autoPlayDelay,
	});
	const [draft, setDraft] = useState<SettingsDraft>(currentDraft);
	const [activeTab, setActiveTab] = useState<"ai" | "display" | "assist">("ai");
	const [testStatus, setTestStatus] = useState<TestStatus>("idle");
	const [testMessage, setTestMessage] = useState("");
	const wasOpenRef = useRef(false);
	const testRequestIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (open && !wasOpenRef.current) {
			testRequestIdRef.current = null;
			setDraft(currentDraft);
			setTestStatus("idle");
			setTestMessage("");
		}
		wasOpenRef.current = open;
	}, [open, currentDraft]);

	useEffect(() => {
		return () => {
			testRequestIdRef.current = null;
		};
	}, []);

	const handleDraftChange = useCallback((update: Partial<SettingsDraft>) => {
		setDraft((current: SettingsDraft) => ({ ...current, ...update }));
	}, []);

	const handleTestConnection = useCallback(async () => {
		const requestId = Date.now();
		testRequestIdRef.current = requestId;
		setTestStatus("testing");
		setTestMessage("");

		const testConfig = {
			provider: draft.llmConfig.provider,
			apiKey: draft.llmConfig.apiKey || "YOUR_API_KEY",
			model: draft.llmConfig.model || "google/gemini-2.0-flash-exp",
		};

		try {
			const response = await callLLM('請回覆"連線成功"四個字。', testConfig);
			if (testRequestIdRef.current !== requestId) {
				return;
			}

			if (response.content && response.content.length > 0) {
				setTestStatus("success");
				setTestMessage(
					`✓ 連線成功！回應: "${response.content.slice(0, 50)}${response.content.length > 50 ? "..." : ""}"`,
				);
			} else {
				setTestStatus("error");
				setTestMessage("✗ 回應為空，請檢查模型名稱是否正確");
			}
		} catch (error) {
			if (testRequestIdRef.current !== requestId) {
				return;
			}

			setTestStatus("error");
			const errorMessage = error instanceof Error ? error.message : "未知錯誤";
			setTestMessage(`✗ 連線失敗: ${errorMessage.slice(0, 100)}`);
		}
	}, [draft.llmConfig]);

	const handleClose = useCallback(() => {
		testRequestIdRef.current = null;
		setDraft(currentDraft);
		setTestStatus("idle");
		setTestMessage("");
		onClose();
	}, [currentDraft, onClose]);

	const handleSave = useCallback(() => {
		setDifficulty(draft.difficulty);
		setAIMode(draft.aiMode);
		setHybridConfig(draft.hybridConfig);
		setTileSize(draft.tileSize);
		setHumanAiMode(draft.humanAiMode);
		setAutoPlayDelay(draft.autoPlayDelay);
		setLLMConfig(draft.llmConfig);
		setAssistMode(draft.assistMode);
		onClose();
	}, [
		draft,
		onClose,
		setAIMode,
		setAssistMode,
		setAutoPlayDelay,
		setDifficulty,
		setHybridConfig,
		setHumanAiMode,
		setLLMConfig,
		setTileSize,
	]);

	if (!open) {
		return null;
	}

	const tabs = [
		{ key: "ai" as const, label: "AI 設定" },
		{ key: "display" as const, label: "介面顯示" },
		{ key: "assist" as const, label: "輔助提示" },
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				type="button"
				aria-label="關閉設定視窗"
				className="absolute inset-0 bg-black/50"
				onClick={handleClose}
			/>
			<div className="z-10 mx-4 flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white p-6 max-h-[90vh]">
				{/* Fixed Header */}
				<h2 className="mb-4 text-xl font-bold">⚙️ 遊戲設定</h2>

				{/* Fixed Tab Bar */}
				<div className="mb-4 flex gap-2 border-b pb-3">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
								activeTab === tab.key
									? "bg-blue-500 text-white"
									: "bg-gray-100 text-gray-600 hover:bg-gray-200"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Scrollable Body */}
				<div className="flex-1 min-h-0 overflow-y-auto pr-1">
					<GameSettings
						draft={draft}
						onDraftChange={handleDraftChange}
						onTestConnection={handleTestConnection}
						testStatus={testStatus}
						testMessage={testMessage}
						activeTab={activeTab}
					/>
				</div>

				{/* Fixed Footer */}
				<div className="mt-4 grid shrink-0 grid-cols-2 gap-3 border-t pt-4">
					<button
						type="button"
						onClick={handleClose}
						className="rounded-lg bg-gray-200 py-2 hover:bg-gray-300"
					>
						取消
					</button>
					<button
						type="button"
						onClick={handleSave}
						className="rounded-lg bg-green-500 py-2 font-medium text-white hover:bg-green-600"
					>
						儲存
					</button>
				</div>
			</div>
		</div>
	);
};

export default SettingsModal;
