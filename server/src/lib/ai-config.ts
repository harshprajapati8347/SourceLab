/** Default chat model when the client or workspace does not specify one. */
export const CHAT_MODEL = "gpt-4o-mini";

/** Allowed chat models exposed to the client and workspace settings. */
export const CHAT_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;

/** OpenAI embedding model used for RAG vector indexing and query embedding. */
export const EMBEDDING_MODEL = "text-embedding-3-small";

/** Vector dimension count — must match Pinecone index configuration. */
export const EMBEDDING_DIMENSIONS = 1536;

/** Target max characters per text chunk during source processing. */
export const CHUNK_SIZE = 1000;

/** Character overlap between consecutive chunks at split boundaries. */
export const CHUNK_OVERLAP = 100;

/** Number of Pinecone chunks to retrieve per chat query. */
export const RAG_TOP_K = 6;

/** Minimum cosine similarity score for a retrieved chunk to be included in context. */
export const RAG_MIN_SCORE = 0.35;

/** Model used for query classification, HyDE, and retrieval-quality judgement. */
export const RAG_INTELLIGENCE_MODEL = "gpt-4o-mini";

/**
 * Retrieval-quality gate. A score below this runs one corrective retrieval pass.
 * Contradiction is not part of this average.
 */
export const RAG_QUALITY_GATE = 0.55;

/**
 * Coverage below this means the retrieved passages do not answer the question.
 * The reply names that gap instead of stopping at a refusal.
 */
export const RAG_TOPIC_COVERAGE_FLOOR = 0.35;

/** Similarity floor used only on the corrective retrieval pass. */
export const RAG_CORRECTIVE_MIN_SCORE = 0.25;

/** Cosine similarity at or above which two chunks are treated as duplicates. */
export const RAG_DEDUP_THRESHOLD = 0.92;

/** Maximum chunks kept after merging parallel retrievals, before compression. */
export const RAG_MERGED_CHUNK_CAP = 8;

/** Maximum characters of chunk text inserted into the chat system prompt. */
export const RAG_CONTEXT_CHAR_BUDGET = 8000;

/** Maximum sub-questions retrieved for multi-hop, analytical, or comparative queries. */
export const RAG_MAX_SUBQUESTIONS = 4;

/** Maximum extra queries generated during the corrective pass. */
export const RAG_MAX_EXPANSIONS = 3;

/** Characters of each chunk embedded for semantic deduplication. */
export const RAG_DEDUP_EMBED_CHARS = 2000;

/** Age in days at which source freshness falls to 0.5. */
export const RAG_FRESHNESS_HALF_LIFE_DAYS = 180;

/** Freshness used when a chunk has no indexed or created time. */
export const RAG_NEUTRAL_FRESHNESS = 0.5;

/** Enqueue a conversation summary job every N persisted messages. */
export const CONVERSATION_SUMMARY_INTERVAL = 8;

/**
 * Maximum user and assistant messages stored on one conversation.
 * The next user message is rejected before retrieval or credit deduction.
 */
export const CHAT_MESSAGE_LIMIT = 10;

/** Max recent UI messages sent to the model when a rolling summary exists. */
export const RECENT_MESSAGE_WINDOW = 12;
