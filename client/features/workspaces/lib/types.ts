export type Workspace = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkspaceInput = {
  title: string;
  description?: string;
  icon?: string;
};

export type UpdateWorkspaceInput = Partial<CreateWorkspaceInput>;
