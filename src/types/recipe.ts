export type RecipeType =
  | 'item_created'
  | 'status_to_value'
  | 'column_changed'
  | 'date_arrived';

export interface RecipeBinding {
  recipeInstanceId: string;
  recipeType: RecipeType;
  boardId: string;
  phoneColumnId: string;
  statusColumnId?: string;
  templateId: string;
  senderIdOverride?: string;
  triggerParams: {
    statusValue?: string;
    columnId?: string;
    dateColumnId?: string;
    daysBefore?: number;
  };
  enabled: boolean;
}
