import { type Category } from '../../../../domain/category/category.entity.ts';
import { type AgentCategoryItem } from '../../format/agent.payload.ts';

/** Categoria no formato do agente. */
export function toAgentCategory(category: Category): AgentCategoryItem {
  return { id: category.id, name: category.name.value, isDefault: category.isDefault };
}
