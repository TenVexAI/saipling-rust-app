import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, AgentPlan, SkillMeta } from '../types/ai';

interface AIState {
  messages: Message[];
  isStreaming: boolean;
  currentPlan: AgentPlan | null;
  activeSkill: string | null;
  availableSkills: SkillMeta[];
  conversationId: string | null;
  lastCost: string | null;

  addMessage: (msg: Message) => void;
  appendToLastAssistant: (chunk: string) => void;
  setMessages: (msgs: Message[]) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;
  setCurrentPlan: (plan: AgentPlan | null) => void;
  setActiveSkill: (skill: string | null) => void;
  setAvailableSkills: (skills: SkillMeta[]) => void;
  setConversationId: (id: string | null) => void;
  setLastCost: (cost: string | null) => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      messages: [],
      isStreaming: false,
      currentPlan: null,
      activeSkill: null,
      availableSkills: [],
      conversationId: null,
      lastCost: null,

      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

      appendToLastAssistant: (chunk) => set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
        } else {
          msgs.push({ role: 'assistant', content: chunk });
        }
        return { messages: msgs };
      }),

      setMessages: (msgs) => set({ messages: msgs }),
      clearMessages: () => set({ messages: [], currentPlan: null, conversationId: null }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setCurrentPlan: (plan) => set({ currentPlan: plan }),
      setActiveSkill: (skill) => set({ activeSkill: skill }),
      setAvailableSkills: (skills) => set({ availableSkills: skills }),
      setConversationId: (id) => set({ conversationId: id }),
      setLastCost: (cost) => set({ lastCost: cost }),
    }),
    {
      name: 'saipling-ai-chat',
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
      partialize: (state) => ({
        messages: state.messages,
        activeSkill: state.activeSkill,
        conversationId: state.conversationId,
        lastCost: state.lastCost,
      } as unknown as AIState),
    }
  )
);
