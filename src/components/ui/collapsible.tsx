import * as React from "react";

export const Collapsible: React.FC<{ open?: boolean; children?: React.ReactNode }> = ({ open, children }) => {
  if (!open) return null;
  return <>{children}</>;
};

export const CollapsibleContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
