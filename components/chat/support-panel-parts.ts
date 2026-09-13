/**
 * The support widget's panel and everything drawn inside it, split out so they
 * load after the page does (#76). Imported ONLY through `import()` in
 * SupportWidget.tsx — see lib/hooks/useIdleImport.ts and root-bundle-guard.test.ts.
 */
export { default as ChatPanel } from '@/components/chat/ChatPanel';
export { default as SignInToChat } from '@/components/chat/SignInToChat';
export { default as SubjectPicker } from '@/components/chat/SubjectPicker';
export { default as ConversationList } from '@/components/chat/ConversationList';
export { default as NewChatComposer } from '@/components/chat/NewChatComposer';
