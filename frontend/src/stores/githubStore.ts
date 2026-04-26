import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedRepo {
  owner: string;
  repo: string;
}

interface PersistedFields {
  pat: string | null;
  username: string | null;
  savedRepos: SavedRepo[];
  panelOpen: boolean;
}

interface GitHubState extends PersistedFields {
  selectedRepo: SavedRepo | null;
  activeTab: "commits" | "prs";

  setPat: (pat: string | null, username?: string | null) => void;
  addRepo: (repo: SavedRepo) => void;
  removeRepo: (owner: string, repo: string) => void;
  selectRepo: (repo: SavedRepo | null) => void;
  setActiveTab: (tab: "commits" | "prs") => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}

export const useGitHubStore = create<GitHubState>()(
  persist(
    (set) => ({
      pat: null,
      username: null,
      savedRepos: [],
      panelOpen: false,
      selectedRepo: null,
      activeTab: "commits",

      setPat: (pat, username = null) => set({ pat, username }),
      addRepo: (repo) =>
        set((s) => {
          const exists = s.savedRepos.some(
            (r) => r.owner === repo.owner && r.repo === repo.repo
          );
          return exists ? s : { savedRepos: [...s.savedRepos, repo] };
        }),
      removeRepo: (owner, repo) =>
        set((s) => ({
          savedRepos: s.savedRepos.filter(
            (r) => !(r.owner === owner && r.repo === repo)
          ),
          selectedRepo:
            s.selectedRepo?.owner === owner && s.selectedRepo?.repo === repo
              ? null
              : s.selectedRepo,
        })),
      selectRepo: (repo) => set({ selectedRepo: repo }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setPanelOpen: (open) => set({ panelOpen: open }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    }),
    {
      name: "whathediff-github",
      partialize: (s): PersistedFields => ({
        pat: s.pat,
        username: s.username,
        savedRepos: s.savedRepos,
        panelOpen: s.panelOpen,
      }),
    }
  )
);
