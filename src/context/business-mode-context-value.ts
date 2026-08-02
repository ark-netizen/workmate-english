import { createContext } from "react";

export interface BusinessModeContextValue {
  businessMode: boolean;
  setBusinessMode: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export const BusinessModeContext = createContext<BusinessModeContextValue | null>(null);
