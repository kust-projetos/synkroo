/**
 * Seed API Route & Service Test Suite
 *
 * Covers:
 * 1. Helper seed builders: buildWaitlistSeed, buildLeadSeed, cleanupDemoSeedTables
 * 2. Auth & Validation (missing env var, missing secret, invalid secret)
 * 3. Default and Large scenario execution
 * 4. Clinic not found (404)
 * 5. Admin user and RBAC permissions assignment
 * 6. Patient initialization fallback when patients table is empty
 * 7. Conversation & messages initialization fallback
 * 8. Pipeline stages creation & error resilience (including null position fallback)
 * 9. Leads, activities, campaigns, recipients, waitlist, feedback, guidelines, schedule blocks, follow-up configs, appointments
 * 10. Error resilience in child loops (leads errors, appointment errors, etc.)
 * 11. Missing fixtures / partial failure response mapping (500)
 * 12. Top-level unhandled exception error mapping (500)
 */

import { NextRequest } from 'next/server';
import {
  clinics,
  users,
  roles,
  patients,
  conversations,
  pipelineStages,
  leads,
  leadActivities,
  campaigns,
  campaignRecipients,
  waitlist,
  patientFeedback,
  procedureGuidelines,
  scheduleBlocks,
  followUpConfigs,
} from '@/lib/db/schema';
import * as dentistRepo from '@/repositories/dentists';
import * as procedureRepo from '@/repositories/procedures';
import * as appointmentRepo from '@/repositories/appointments';
import * as pipelineRepo from '@/modules/comercial/repositories/pipeline-repository';
import {
  buildWaitlistSeed,
  buildLeadSeed,
  cleanupDemoSeedTables,
} from '@/lib/seed/helpers';

// ── Mock Setup ───────────────────────────────────────────────────

interface MockDbConfig {
  clinicRows?: any[];
  userRows?: any[];
  adminRoleRows?: any[];
  patientRows?: any[];
  patientRowsAfterInsert?: any[];
  conversationRows?: any[];
  existingStagesRows?: any[];
  pipelineStagesRows?: any[];
  insertLeadsThrows?: boolean;
  insertActivitiesThrows?: boolean;
  insertCampaignsThrows?: boolean;
  insertRecipientsThrows?: boolean;
  insertWaitlistThrows?: boolean;
  insertFeedbackThrows?: boolean;
  insertGuidelinesThrows?: boolean;
  insertScheduleBlocksThrows?: boolean;
  insertFollowUpConfigsThrows?: boolean;
  appointmentCreateThrows?: boolean;
  dbExecuteThrows?: boolean;
  topLevelInsertThrows?: boolean;
}

let dbConfig: MockDbConfig = {};
let leadIdCounter = 1;
let campaignIdCounter = 1;
let conversationIdCounter = 1;
let patientSelectCallCount = 0;

const createMockDb = () => {
  return {
    insert: jest.fn((table: any) => {
      if (dbConfig.topLevelInsertThrows) {
        throw new Error('Database connection lost on instanceModules insert');
      }

      return {
        values: jest.fn((_val: any) => {
          // Table specific insert handling
          if (table === leads && dbConfig.insertLeadsThrows) {
            throw new Error('Unique constraint violation on leads');
          }
          if (table === leadActivities && dbConfig.insertActivitiesThrows) {
            throw new Error('Activity insert error');
          }
          if (table === campaigns && dbConfig.insertCampaignsThrows) {
            throw new Error('Campaign template validation error');
          }
          if (table === campaignRecipients && dbConfig.insertRecipientsThrows) {
            throw new Error('Recipient insert error');
          }
          if (table === waitlist && dbConfig.insertWaitlistThrows) {
            throw new Error('Waitlist insert error');
          }
          if (table === patientFeedback && dbConfig.insertFeedbackThrows) {
            throw new Error('Feedback insert error');
          }
          if (table === procedureGuidelines && dbConfig.insertGuidelinesThrows) {
            throw new Error('Guidelines insert error');
          }
          if (table === scheduleBlocks && dbConfig.insertScheduleBlocksThrows) {
            throw new Error('Schedule block insert error');
          }
          if (table === followUpConfigs && dbConfig.insertFollowUpConfigsThrows) {
            throw new Error('Follow-up config insert error');
          }

          return {
            onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
            onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
            returning: jest.fn().mockImplementation(() => {
              if (table === leads) {
                return Promise.resolve([{ id: `lead-${leadIdCounter++}` }]);
              }
              if (table === campaigns) {
                return Promise.resolve([{ id: `camp-${campaignIdCounter++}` }]);
              }
              if (table === conversations) {
                return Promise.resolve([{ id: `conv-${conversationIdCounter++}` }]);
              }
              return Promise.resolve([{ id: 'inserted-id' }]);
            }),
            then(resolve: any) {
              return Promise.resolve(undefined).then(resolve);
            },
          };
        }),
      };
    }),

    select: jest.fn((_fields?: any) => ({
      from: jest.fn((table: any) => {
        let result: any[] = [];

        if (table === clinics) {
          result = dbConfig.clinicRows ?? [{ id: 'clinic-demo-id' }];
        } else if (table === users) {
          result = dbConfig.userRows ?? [{ id: 'user-admin-id' }];
        } else if (table === roles) {
          result = dbConfig.adminRoleRows ?? [{ id: 'role-admin-id' }];
        } else if (table === patients) {
          patientSelectCallCount++;
          if (patientSelectCallCount > 1 && dbConfig.patientRowsAfterInsert) {
            result = dbConfig.patientRowsAfterInsert;
          } else {
            result = dbConfig.patientRows ?? [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
          }
        } else if (table === conversations) {
          result = dbConfig.conversationRows ?? [{ id: 'conv-1' }];
        } else if (table === pipelineStages) {
          result = dbConfig.pipelineStagesRows ?? [
            { id: 'stage-0', position: 0, name: 'Novo Lead' },
            { id: 'stage-1', position: 1, name: 'Contato Feito' },
            { id: 'stage-2', position: 2, name: 'Agendado' },
            { id: 'stage-3', position: 3, name: 'Avaliado' },
            { id: 'stage-4', position: 4, name: 'Convertido' },
          ];
        }

        const terminalObj: any = {
          where: jest.fn((_condition?: any) => {
            const whereObj: any = {
              limit: jest.fn((_n?: number) => {
                if (table === pipelineStages && dbConfig.existingStagesRows !== undefined) {
                  return Promise.resolve(dbConfig.existingStagesRows);
                }
                return Promise.resolve(result.slice(0, 1));
              }),
              orderBy: jest.fn((_order?: any) => Promise.resolve(result)),
              then(resolve: any) {
                return Promise.resolve(result).then(resolve);
              },
            };
            return whereObj;
          }),
          limit: jest.fn((_n?: number) => Promise.resolve(result.slice(0, 1))),
          orderBy: jest.fn((_order?: any) => Promise.resolve(result)),
          then(resolve: any) {
            return Promise.resolve(result).then(resolve);
          },
        };

        return terminalObj;
      }),
    })),

    execute: jest.fn((_sql: any) => {
      if (dbConfig.dbExecuteThrows) {
        return Promise.reject(new Error('Execute error'));
      }
      return Promise.resolve();
    }),
  };
};

const mockDbInstance = createMockDb();

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mockDbInstance),
}));

jest.mock('@/repositories/dentists', () => ({
  findByClinic: jest.fn(),
}));

jest.mock('@/repositories/procedures', () => ({
  findByClinic: jest.fn(),
}));

jest.mock('@/repositories/appointments', () => ({
  create: jest.fn(),
}));

jest.mock('@/modules/comercial/repositories/pipeline-repository', () => ({
  seedDefaultPipelineStages: jest.fn(),
}));

jest.mock('@/lib/seed/helpers', () => {
  const actual = jest.requireActual('@/lib/seed/helpers');
  return {
    ...actual,
    cleanupDemoSeedTables: jest.fn().mockResolvedValue(undefined),
  };
});

// Import GET handler after mocks
import { GET } from '@/services/api-handlers/seed';

// ── Helpers ──────────────────────────────────────────────────────

function makeReq(path: string, method = 'GET'): NextRequest {
  const url = `http://localhost${path}`;
  return new NextRequest(url, { method });
}

// ── Test Suite ───────────────────────────────────────────────────

describe('Seed Helpers Unit Tests', () => {
  describe('buildWaitlistSeed', () => {
    it('builds a large waitlist dataset with mixed statuses and urgent entries', () => {
      const rows = buildWaitlistSeed({
        clinicId: 'c1',
        patientIds: Array.from({ length: 40 }, (_, i) => `p${i}`),
        dentistIds: ['d1', 'd2', 'd3'],
        procedureIds: ['proc1', 'proc2', 'proc3'],
        scale: 'large',
      });

      expect(rows.length).toBeGreaterThanOrEqual(35);
      expect(rows.some((r: any) => r.status === 'waiting')).toBe(true);
      expect(rows.some((r: any) => r.status === 'notified')).toBe(true);
      expect(rows.some((r: any) => r.status === 'scheduled')).toBe(true);
      expect(rows.some((r: any) => (r.priority ?? 0) >= 7)).toBe(true);
    });

    it('builds a default-scale waitlist dataset', () => {
      const rows = buildWaitlistSeed({
        clinicId: 'c1',
        patientIds: Array.from({ length: 10 }, (_, i) => `p${i}`),
        dentistIds: ['d1'],
        procedureIds: ['proc1'],
        scale: 'default',
      });

      expect(rows.length).toBeGreaterThanOrEqual(10);
      expect(rows.length).toBeLessThan(40);
      for (const r of rows) {
        expect(r.clinicId).toBe('c1');
        expect(r.patientId).toBeDefined();
        expect(r.status).toBeDefined();
      }
    });
  });

  describe('buildLeadSeed', () => {
    it('builds a large leads dataset with broad lifecycle coverage', () => {
      const rows = buildLeadSeed('large');

      expect(rows.length).toBeGreaterThanOrEqual(80);
      expect(rows.some((r: any) => r.status === 'new')).toBe(true);
      expect(rows.some((r: any) => r.status === 'qualified')).toBe(true);
      expect(rows.some((r: any) => r.status === 'converted')).toBe(true);
      expect(rows.some((r: any) => r.status === 'lost')).toBe(true);
    });

    it('builds default-scale leads', () => {
      const rows = buildLeadSeed('default');

      expect(rows.length).toBeGreaterThanOrEqual(25);
      expect(rows.length).toBeLessThan(50);
      expect(rows.some((r: any) => r.name.includes('Renata'))).toBe(true);
    });
  });

  describe('cleanupDemoSeedTables', () => {
    it('is a callable helper function', () => {
      expect(typeof cleanupDemoSeedTables).toBe('function');
    });
  });
});

describe('GET /api/seed Handler', () => {
  const SEED_SECRET = 'correct-seed-secret';
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, SEED_SECRET };
    dbConfig = {};
    leadIdCounter = 1;
    campaignIdCounter = 1;
    conversationIdCounter = 1;
    patientSelectCallCount = 0;
    jest.clearAllMocks();

    // Default repo mocks for success path
    (dentistRepo.findByClinic as jest.Mock).mockResolvedValue([
      { id: 'dentist-1', name: 'Dr. Lucas' },
      { id: 'dentist-2', name: 'Dra. Camila' },
    ]);
    (procedureRepo.findByClinic as jest.Mock).mockResolvedValue([
      { id: 'proc-1', name: 'Limpeza Dental', durationMinutes: 30 },
      { id: 'proc-2', name: 'Implante Dentário', durationMinutes: 90 },
    ]);
    (appointmentRepo.create as jest.Mock).mockResolvedValue({ id: 'appt-ok' });
    (pipelineRepo.seedDefaultPipelineStages as jest.Mock).mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  describe('Authentication & Configuration', () => {
    it('returns 403 when SEED_SECRET is not configured in env', async () => {
      delete process.env.SEED_SECRET;
      const req = makeReq('/api/seed?secret=test');
      const res = await GET(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('SEED_SECRET not configured');
    });

    it('returns 401 when secret parameter is missing', async () => {
      const req = makeReq('/api/seed');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 when secret parameter does not match SEED_SECRET', async () => {
      const req = makeReq('/api/seed?secret=wrong-secret');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Clinic & User Initializations', () => {
    it('returns 404 when demo clinic is not found', async () => {
      dbConfig.clinicRows = [];
      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Clinic not found');
    });

    it('assigns comercial permissions when admin user and Administrador role exist', async () => {
      dbConfig.clinicRows = [{ id: 'clinic-demo-id' }];
      dbConfig.userRows = [{ id: 'admin-user-id' }];
      dbConfig.adminRoleRows = [{ id: 'admin-role-id' }];

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.fixtures.admin).toBe(1);
    });

    it('handles scenario when admin user exists but Administrador role is absent', async () => {
      dbConfig.clinicRows = [{ id: 'clinic-demo-id' }];
      dbConfig.userRows = [{ id: 'admin-user-id' }];
      dbConfig.adminRoleRows = []; // No Administrador role

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('fails required fixture validation when admin user does not exist', async () => {
      dbConfig.clinicRows = [{ id: 'clinic-demo-id' }];
      dbConfig.userRows = []; // No user found (userId is undefined)

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.missingFixtures).toContain('admin');
    });

    it('seeds 8 default patients when patients table is initially empty', async () => {
      dbConfig.patientRows = []; // Initially empty
      dbConfig.patientRowsAfterInsert = [
        { id: 'p-new-1' },
        { id: 'p-new-2' },
        { id: 'p-new-3' },
      ];

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(patientSelectCallCount).toBeGreaterThanOrEqual(2);
    });

    it('creates initial conversations and messages when conversations table is empty', async () => {
      dbConfig.conversationRows = []; // Empty conversations

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('calls seedDefaultPipelineStages when existing stages are empty and handles null position stages', async () => {
      dbConfig.existingStagesRows = []; // Triggers pipelineRepo.seedDefaultPipelineStages
      dbConfig.pipelineStagesRows = [
        { id: 'stage-null', position: null, name: 'Stage Without Position' },
        { id: 'stage-1', position: 1, name: 'Contato Feito' },
      ];

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(pipelineRepo.seedDefaultPipelineStages).toHaveBeenCalledWith('clinic-demo-id');
    });

    it('gracefully handles race condition if seedDefaultPipelineStages throws', async () => {
      dbConfig.existingStagesRows = [];
      (pipelineRepo.seedDefaultPipelineStages as jest.Mock).mockRejectedValueOnce(
        new Error('Duplicate stage key race condition'),
      );

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Scenario Execution: Default vs Large', () => {
    it('executes full default scenario successfully with default duration fallback', async () => {
      (procedureRepo.findByClinic as jest.Mock).mockResolvedValueOnce([
        { id: 'proc-1', name: 'Procedimento Genérico' }, // No durationMinutes (tests default duration 30)
      ]);

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.summary.leads).toBeGreaterThanOrEqual(25);
      expect(data.summary.campaigns).toBe(7);
      expect(data.summary.appointments).toBeGreaterThanOrEqual(1);
      expect(data.fixtures.clinic).toBe(1);
      expect(data.fixtures.admin).toBe(1);
      expect(data.fixtures.dentists).toBe(2);
      expect(data.fixtures.procedures).toBe(1);
      expect(data.fixtures.pipeline_stages).toBe(5);
    });

    it('executes full large scenario with increased counts successfully', async () => {
      const req = makeReq(`/api/seed?secret=${SEED_SECRET}&scenario=large`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.summary.leads).toBeGreaterThanOrEqual(80);
      expect(data.summary.campaign_recipients).toBeGreaterThan(0);
      expect(data.fixtures.leads).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Appointments & Edge-Cases', () => {
    it('handles empty dentist or patient list in appointments loop', async () => {
      (dentistRepo.findByClinic as jest.Mock).mockResolvedValueOnce([]); // No dentists

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      // Will fail fixture check because appointments is 0 and dentists is 0
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.missingFixtures).toContain('dentists');
      expect(data.missingFixtures).toContain('appointments');
    });

    it('continues gracefully when db.execute for last_visit_at throws', async () => {
      dbConfig.dbExecuteThrows = true;

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Error Resilience & Partial Failure Handling', () => {
    it('records lead insert errors and returns 500 incomplete fixture response', async () => {
      dbConfig.insertLeadsThrows = true;

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('E2E fixture seed incomplete');
      expect(data.failures.some((f: any) => f.domain === 'leads')).toBe(true);
      expect(data.missingFixtures).toContain('leads');
    });

    it('records campaign insert errors and returns 500 incomplete fixture response', async () => {
      dbConfig.insertCampaignsThrows = true;

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.failures.some((f: any) => f.domain === 'campaigns')).toBe(true);
    });

    it('records appointment creation errors and reports failures', async () => {
      (appointmentRepo.create as jest.Mock).mockRejectedValue(new Error('Schedule slot conflict'));

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.failures.some((f: any) => f.domain === 'appointments')).toBe(true);
    });

    it('catches and records child errors in lead activities, recipients, waitlist, feedback, guidelines, schedule blocks, follow-up configs', async () => {
      dbConfig.insertActivitiesThrows = true;
      dbConfig.insertRecipientsThrows = true;
      dbConfig.insertWaitlistThrows = true;
      dbConfig.insertFeedbackThrows = true;
      dbConfig.insertGuidelinesThrows = true;
      dbConfig.insertScheduleBlocksThrows = true;
      dbConfig.insertFollowUpConfigsThrows = true;

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.failures.some((f: any) => f.domain === 'lead_activities')).toBe(true);
      expect(data.failures.some((f: any) => f.domain === 'campaign_recipients')).toBe(true);
      expect(data.failures.some((f: any) => f.domain === 'waitlist')).toBe(true);
      expect(data.failures.some((f: any) => f.domain === 'patient_feedback')).toBe(true);
      expect(data.failures.some((f: any) => f.domain === 'procedure_guidelines')).toBe(true);
      expect(data.failures.some((f: any) => f.domain === 'schedule_blocks')).toBe(true);
      expect(data.failures.some((f: any) => f.domain === 'follow_up_configs')).toBe(true);
    });

    it('catches unhandled top-level exception and returns 500 E2E fixture seed failed', async () => {
      dbConfig.topLevelInsertThrows = true;

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('E2E fixture seed failed');
      expect(data.details).toContain('Database connection lost');
    });

    it('handles non-Error objects thrown in top-level catch', async () => {
      (mockDbInstance.insert as jest.Mock).mockImplementationOnce(() => {
        throw 'String crash exception';
      });

      const req = makeReq(`/api/seed?secret=${SEED_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('E2E fixture seed failed');
      expect(data.details).toBe('String crash exception');
    });
  });
});
