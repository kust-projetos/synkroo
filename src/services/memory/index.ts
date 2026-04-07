/**
 * Memory Services Index
 * Exports all 5 memory layers and the memory manager
 */

// L1 Session - In-Memory
export {
  l1SessionService,
  L1SessionService,
} from './L1-session.service'

export type {
  L1Session,
  L1SessionMessage,
} from './L1-session.service'

// L2 Patient - PostgreSQL
export {
  l2PatientService,
  L2PatientService,
} from './L2-patient.service'

export type {
  L2Patient,
  L2PatientPreferences,
  L2PatientHistoryEntry,
} from './L2-patient.service'

// L3 Clinic - PostgreSQL + Cache
export {
  l3ClinicService,
  L3ClinicService,
} from './L3-clinic.service'

export type {
  L3Clinic,
  L3ClinicAddress,
  L3ClinicHours,
  L3ClinicProfessional,
  L3ClinicProcedure,
  L3CancellationPolicy,
} from './L3-clinic.service'

// L4 Conversation - PostgreSQL
export {
  l4ConversationService,
  L4ConversationService,
} from './L4-conversation.service'

export type {
  L4Conversation,
  L4ConversationMessage,
} from './L4-conversation.service'

// L5 RAG - Semantic Search
export {
  l5RAGService,
  L5RAGService,
} from './L5-rag.service'

export type {
  L5Knowledge,
  L5MemoryResult,
  L5SearchOptions,
  L5Context,
} from './L5-rag.service'

// Memory Manager
export {
  memoryManager,
  MemoryManager,
} from './memory.manager'

export type {
  ContextLoadOptions,
  MemoryLoadResult,
} from './memory.manager'
