/**
 * Message Templates Service Tests
 * Migrated from Supabase to Drizzle
 *
 * Mock pattern: use jest.requireActual inside factory to avoid hoisting issues.
 * jest.mock is hoisted, so the factory cannot reference variables declared later.
 * Solution: factory calls jest.requireActual and wraps with spy/mock at call time.
 */

jest.mock("@/lib/db/client", () => {
	// jest.requireActual is available inside factory — avoids hoisting problem
	const actual = jest.requireActual("@/lib/db/client");
	return {
		...actual,
		// Override getDb with a spy that we can control per-test
		getDb: jest.fn(() => actual.getDb()),
	};
});

jest.mock("@/lib/logger", () => ({
	dbLogger: {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	},
}));

// ─── Import service ────────────────────────────────────────────

import {
	getApprovedTemplates,
	getAllTemplates,
	createTemplate,
	fillTemplate,
	isTemplateNeeded,
	getTemplateByName,
} from "../message-templates.service";

import { getDb } from "@/lib/db/client";

// ─── Test fixtures ─────────────────────────────────────────────

const mockTemplate = {
	id: "tpl-123",
	clinicId: "clinic-1",
	name: "appointment_reminder",
	category: "UTILITY" as const,
	language: "pt_BR",
	header: "Lembrete de Consulta",
	body: "Olá {{1}}, sua consulta é às {{2}}",
	footer: "Respondendo: Clínica Sorriso",
	buttons: [
		{ type: "QUICK_REPLY" as const, text: "Confirmar" },
		{ type: "QUICK_REPLY" as const, text: "Remarcar" },
	],
	status: "APPROVED" as const,
	metaTemplateId: "meta-123",
	createdAt: new Date("2026-03-01T10:00:00Z"),
	updatedAt: new Date("2026-03-01T10:00:00Z"),
};

// ─── Tests ─────────────────────────────────────────────────────

describe("MessageTemplates Service", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Reset getDb spy to call real implementation by default
		(getDb as jest.Mock).mockImplementation(() => {
			// Real implementation would throw without DATABASE_URL, which is what we want
			// to avoid in tests — we override per test below
			throw new Error("No DATABASE_URL — mock must override getDb in test");
		});
	});

	describe("getApprovedTemplates", () => {
		it("should return approved templates", async () => {
			const templates = [
				mockTemplate,
				{ ...mockTemplate, id: "tpl-456", category: "MARKETING" as const },
			];
			(getDb as jest.Mock).mockReturnValue({
				select: () => ({
					from: () => ({
						where: () => ({
							orderBy: () => Promise.resolve(templates),
						}),
					}),
				}),
			});

			const result = await getApprovedTemplates("clinic-1");

			expect(result).toEqual(templates);
		});

		it("should return empty array when no templates", async () => {
			(getDb as jest.Mock).mockReturnValue({
				select: () => ({
					from: () => ({
						where: () => ({
							orderBy: () => Promise.resolve([]),
						}),
					}),
				}),
			});

			const result = await getApprovedTemplates("clinic-1");

			expect(result).toEqual([]);
		});

		it("should call db.select", async () => {
			(getDb as jest.Mock).mockReturnValue({
				select: () => ({
					from: () => ({
						where: () => ({
							orderBy: () => Promise.resolve([]),
						}),
					}),
				}),
			});

			await getApprovedTemplates("clinic-1");

			expect(getDb).toHaveBeenCalled();
		});
	});

	describe("getAllTemplates", () => {
		it("should return all templates", async () => {
			const templates = [
				mockTemplate,
				{
					...mockTemplate,
					id: "tpl-456",
					status: "PENDING" as const,
					createdAt: new Date("2026-03-31T10:00:00Z"),
				},
			];
			(getDb as jest.Mock).mockReturnValue({
				select: () => ({
					from: () => ({
						where: () => ({
							orderBy: () => Promise.resolve(templates),
						}),
					}),
				}),
			});

			const result = await getAllTemplates("clinic-1");

			expect(result).toEqual(templates);
		});

		it("should return empty array when no templates", async () => {
			(getDb as jest.Mock).mockReturnValue({
				select: () => ({
					from: () => ({
						where: () => ({
							orderBy: () => Promise.resolve([]),
						}),
					}),
				}),
			});

			const result = await getAllTemplates("clinic-1");

			expect(result).toEqual([]);
		});
	});

	describe("createTemplate", () => {
		it("should create template with PENDING status and pt_BR language", async () => {
			const params = {
				clinicId: "clinic-1",
				name: "new_template",
				category: "MARKETING" as const,
				body: "Hello {{1}}",
			};

			const returning = {
				...mockTemplate,
				...params,
				status: "PENDING" as const,
				language: "pt_BR",
			};
			(getDb as jest.Mock).mockReturnValue({
				insert: () => ({
					values: () => ({
						returning: () => Promise.resolve([returning]),
					}),
				}),
			});

			const result = await createTemplate(params);

			expect(result).toMatchObject({
				name: "new_template",
				category: "MARKETING",
				status: "PENDING",
				language: "pt_BR",
			});
		});

		it("should return null when insert returns empty", async () => {
			const params = {
				clinicId: "clinic-1",
				name: "fail_template",
				category: "UTILITY" as const,
				body: "Test",
			};

			(getDb as jest.Mock).mockReturnValue({
				insert: () => ({
					values: () => ({
						returning: () => Promise.resolve([]),
					}),
				}),
			});

			const result = await createTemplate(params);

			expect(result).toBeNull();
		});

		it("should call db.insert", async () => {
			const params = {
				clinicId: "clinic-1",
				name: "test",
				category: "UTILITY" as const,
				body: "Body",
			};

			(getDb as jest.Mock).mockReturnValue({
				insert: () => ({
					values: () => ({
						returning: () => Promise.resolve([mockTemplate]),
					}),
				}),
			});

			await createTemplate(params);

			expect(getDb).toHaveBeenCalled();
		});
	});

	describe("fillTemplate", () => {
		it("should replace numbered placeholders", () => {
			const result = fillTemplate(
				{ ...mockTemplate, body: "Olá {{1}}, sua consulta é às {{2}}" },
				{ "1": "João", "2": "14:00" },
			);
			expect(result).toBe("Olá João, sua consulta é às 14:00");
		});

		it("should replace named placeholders", () => {
			const result = fillTemplate(
				{ ...mockTemplate, body: "Olá {{nome}}, seu aparelho é {{modelo}}" },
				{ nome: "Maria", modelo: "Invisalign" },
			);
			expect(result).toBe("Olá Maria, seu aparelho é Invisalign");
		});

		it("should keep placeholder when value is missing", () => {
			const result = fillTemplate(
				{ ...mockTemplate, body: "Olá {{1}}, sua consulta é às {{2}}" },
				{ "1": "João" },
			);
			expect(result).toBe("Olá João, sua consulta é às {{2}}");
		});

		it("should handle mixed numbered and named placeholders", () => {
			const result = fillTemplate(
				{
					...mockTemplate,
					body: "{{1}}, seu appt é {{2}} na clínica {{nome}}",
				},
				{ "1": "Carlos", "2": "15:30", nome: "Sorriso" },
			);
			expect(result).toBe("Carlos, seu appt é 15:30 na clínica Sorriso");
		});

		it("should replace all occurrences of named placeholder", () => {
			const result = fillTemplate(
				{
					...mockTemplate,
					body: "Olá {{nome}}, {{nome}}! Sua consulta {{nome}} está confirmada.",
				},
				{ nome: "Ana" },
			);
			expect(result).toBe("Olá Ana, Ana! Sua consulta Ana está confirmada.");
		});

		it("should handle template with no placeholders", () => {
			const result = fillTemplate(
				{ ...mockTemplate, body: "Mensagem simples sem placeholders" },
				{},
			);
			expect(result).toBe("Mensagem simples sem placeholders");
		});
	});

	describe("isTemplateNeeded", () => {
		it("should return true when lastMessageAt is null", () => {
			expect(isTemplateNeeded(null)).toBe(true);
		});

		it("should return true when last message was more than 24 hours ago", () => {
			const twentyFiveHoursAgo = new Date(
				Date.now() - 25 * 60 * 60 * 1000,
			).toISOString();
			expect(isTemplateNeeded(twentyFiveHoursAgo)).toBe(true);
		});

		it("should return false when last message was less than 24 hours ago", () => {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			expect(isTemplateNeeded(oneHourAgo)).toBe(false);
		});

		it("should return true when last message was 25 hours ago", () => {
			const twentyFiveHoursAgo = new Date(
				Date.now() - 25 * 60 * 60 * 1000,
			).toISOString();
			expect(isTemplateNeeded(twentyFiveHoursAgo)).toBe(true);
		});

		it("should return false for messages sent just now", () => {
			const now = new Date().toISOString();
			expect(isTemplateNeeded(now)).toBe(false);
		});
	});

	describe("getTemplateByName", () => {
		it("should return template when found", async () => {
			(getDb as jest.Mock).mockReturnValue({
				select: () => ({
					from: () => ({
						where: () => ({
							limit: () => Promise.resolve([mockTemplate]),
						}),
					}),
				}),
			});

			const result = await getTemplateByName(
				"clinic-1",
				"appointment_reminder",
			);

			expect(result).toEqual(mockTemplate);
		});

		it("should return null when not found", async () => {
			(getDb as jest.Mock).mockReturnValue({
				select: () => ({
					from: () => ({
						where: () => ({
							limit: () => Promise.resolve([]),
						}),
					}),
				}),
			});

			const result = await getTemplateByName("clinic-1", "nonexistent");

			expect(result).toBeNull();
		});
	});
});
