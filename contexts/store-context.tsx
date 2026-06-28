"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./auth-context";

interface StoreOption {
  id: number;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  tax_id?: string;
  tax_name?: string;
  website?: string;
  logo?: string;
}

interface BranchOption {
  id: number;
  code: string;
  name: string;
  store_id: number;
}

interface StoreContextType {
  stores: StoreOption[];
  branches: BranchOption[];
  selectedStore: StoreOption | null;
  selectedBranch: BranchOption | null;
  setSelectedStore: (store: StoreOption | null) => void;
  setSelectedBranch: (branch: BranchOption | null) => void;
  loading: boolean;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, isMaster, isOwner } = useAuth();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedStore, setSelectedStoreState] = useState<StoreOption | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchOption | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStores = useCallback(async () => {
    try {
      const res = await api.get<StoreOption[]>("/stores?limit=100");
      const storeList = (res.data as unknown as StoreOption[]) || [];
      setStores(storeList);

      // Auto-select for non-master users
      if (!isMaster && user?.store_id) {
        const userStore = storeList.find((s) => s.id === user.store_id);
        if (userStore) {
          setSelectedStoreState(userStore);
        }
      }
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [user, isMaster]);

  // Load branches when store is selected
  useEffect(() => {
    if (selectedStore) {
      api
        .get<BranchOption[]>(`/stores/${selectedStore.id}/branches?limit=100`)
        .then((res) => {
          const branchList = (res.data as unknown as BranchOption[]) || [];
          setBranches(branchList);

          // Auto-select branch for employee users
          if (!isMaster && !isOwner && user?.branch_id) {
            const userBranch = branchList.find((b) => b.id === user.branch_id);
            if (userBranch) {
              setSelectedBranch(userBranch);
            }
          }
        })
        .catch(() => setBranches([]));
    } else {
      setBranches([]);
      setSelectedBranch(null);
    }
  }, [selectedStore, user, isMaster, isOwner]);

  useEffect(() => {
    if (user) {
      refreshStores();
    }
  }, [user, refreshStores]);

  const setSelectedStore = (store: StoreOption | null) => {
    setSelectedStoreState(store);
    setSelectedBranch(null);
  };

  return (
    <StoreContext.Provider
      value={{
        stores,
        branches,
        selectedStore,
        selectedBranch,
        setSelectedStore,
        setSelectedBranch,
        loading,
        refreshStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
