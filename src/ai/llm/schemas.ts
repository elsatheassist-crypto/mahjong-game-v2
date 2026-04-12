/**
 * Schema for discard decision (decide function)
 * LLM returns JSON with tile_name and optional reasoning
 */
export interface DiscardDecisionSchema {
  /**
   * Optional: LLM's reasoning for the discard choice
   */
  reasoning?: string;
  
  /**
   * Required: tile display name like "三萬", "東"
   * Must match values from TILE_DISPLAY in src/core/tile.ts
   */
  tile_name: string;
}

/**
 * Schema for meld decision (decideMeld function)
 * chi/peng/gang/hu on opponent's discard
 */
export interface MeldDecisionSchema {
  /**
   * Optional: LLM's reasoning for the meld choice
   */
  reasoning?: string;
  
  /**
   * Required: 1-based index matching prompt options
   * Corresponds to the numbered list in buildMeldPrompt
   */
  action_index: number;
}

/**
 * Schema for self-drawn decision (decideSelfDrawn function)
 * angang/upgrade/hu after drawing
 */
export interface SelfDrawnDecisionSchema {
  /**
   * Optional: LLM's reasoning for the self-drawn choice
   */
  reasoning?: string;
  
  /**
   * Required: 1-based index matching prompt options
   * Corresponds to the numbered list in buildSelfDrawnPrompt
   */
  action_index: number;
}