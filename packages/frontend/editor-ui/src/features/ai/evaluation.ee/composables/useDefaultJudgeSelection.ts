import { computed, type ComputedRef } from 'vue';

import { injectWorkflowDocumentStore } from '@/app/stores/workflowDocument.store';
import { useCredentialsStore } from '@/features/credentials/credentials.store';

import { LM_SUBNODE_TYPE_TO_CHATHUB_PROVIDER } from '../evaluation.constants';
import type { JudgeSelection } from '../wizardSidepanel.store';

// Inspects the first language-model sub-node placed on the canvas and exposes
// a default `JudgeSelection` to pre-fill the LLM-judge model picker with. The
// canvas-order pick mirrors `useAiRootNodes`: stable across re-renders and
// matches what the user sees when scanning the workflow top-to-bottom.
//
// Returns `null` when:
//   - no matching sub-node exists,
//   - the sub-node has no `model` parameter set, or
//   - the sub-node's credential id isn't readable by the current user (we
//     leave the slot empty rather than persist a credentialId the chat-hub
//     picker can't render — the caller can fall back to the auto-selected
//     credential if it wants).
//
// Why look at sub-nodes rather than the chat-hub catalog: the user has
// already wired up a real provider in the workflow they're evaluating, so
// reusing that selection is the lowest-friction default.
export function useDefaultJudgeSelection(): ComputedRef<JudgeSelection | null> {
	const workflowDocumentStore = injectWorkflowDocumentStore();
	const credentialsStore = useCredentialsStore();

	return computed<JudgeSelection | null>(() => {
		const allNodes = workflowDocumentStore.value?.allNodes ?? [];
		for (const node of allNodes) {
			const provider = LM_SUBNODE_TYPE_TO_CHATHUB_PROVIDER[node.type];
			if (!provider) continue;

			const model = extractModelId(node.parameters?.model);
			if (!model) continue;

			const credentialId = extractCredentialId(node.credentials);
			if (!credentialId) continue;

			// Only adopt the workflow's credential when the current user can
			// actually see it — otherwise the picker would render an unresolvable
			// id. The caller can fall back to chat-hub's auto-selected credential
			// for the provider when we return null here.
			if (!credentialsStore.allCredentials.some((c) => c.id === credentialId)) continue;

			return { provider, model, credentialId };
		}
		return null;
	});
}

// `model` is a string on older lmChat* versions (`type: options`) and a
// resource-locator object on newer ones (`type: resourceLocator`, `__rl: true`).
// Normalize to the underlying id string so the picker can match it to a
// catalog entry — or render the raw id when it doesn't.
function extractModelId(model: unknown): string | undefined {
	if (typeof model === 'string') return model || undefined;
	if (model && typeof model === 'object' && 'value' in model) {
		const value = (model as { value: unknown }).value;
		if (typeof value === 'string') return value || undefined;
	}
	return undefined;
}

// lmChat* sub-nodes have exactly one credential slot. Reading the first
// non-empty id is safer than hard-coding the credential-type lookup (which
// would couple us to PROVIDER_CREDENTIAL_TYPE_MAP and break if a node type
// ever advertises an extends-credential or a renamed slot).
function extractCredentialId(
	credentials: Record<string, { id: string | null }> | undefined,
): string | undefined {
	if (!credentials) return undefined;
	for (const slot of Object.values(credentials)) {
		if (slot?.id) return slot.id;
	}
	return undefined;
}
