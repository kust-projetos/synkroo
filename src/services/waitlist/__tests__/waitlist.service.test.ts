/**
 * Tests for Waitlist Service
 * Covers: addToWaitlist, getWaitlist, findMatchingWaitlist, cancelWaitlistEntry, expireOldWaitlistEntries
 */

import {
	addToWaitlist,
	getWaitlist,
	findMatchingWaitlist,
	cancelWaitlistEntry,
	expireOldWaitlistEntries,
} from "../waitlist.service";

// Mock the waitlist repository
jest.mock("@/repositories/waitlist", () => ({
	createWaitlistEntry: jest.fn(),
	findByPatientClinicDate: jest.fn(),
	findByClinic: jest.fn(),
	findMatchingEntries: jest.fn(),
	markNotified: jest.fn(),
	markScheduled: jest.fn(),
	cancelEntry: jest.fn(),
	expireOldEntries: jest.fn(),
}));

// Mock Supabase typed client (used for patient/procedure/dentist lookups in addToWaitlist)
jest.mock("@/lib/supabase/typed", () => ({
	createTypedClient: jest.fn(),
}));

// Mock fetch for WhatsApp notifications
global.fetch = jest.fn().mockResolvedValue({ ok: true });

const {
	createWaitlistEntry,
	findByPatientClinicDate,
	findByClinic,
	findMatchingEntries,
	markNotified,
	cancelEntry,
	expireOldEntries,
} = require("@/repositories/waitlist");

beforeEach(() => {
	jest.clearAllMocks();
	// Default successful repository behaviors
	(findByPatientClinicDate as jest.Mock).mockResolvedValue(null);
	(createWaitlistEntry as jest.Mock).mockResolvedValue({ id: "w1" });
	(findByClinic as jest.Mock).mockResolvedValue([]);
	(findMatchingEntries as jest.Mock).mockResolvedValue([]);
	(markNotified as jest.Mock).mockResolvedValue(undefined);
	(cancelEntry as jest.Mock).mockResolvedValue(true);
	(expireOldEntries as jest.Mock).mockResolvedValue([]);
	// Default Supabase client
	const createTypedClient = require("@/lib/supabase/typed").createTypedClient;
	(createTypedClient as jest.Mock).mockResolvedValue({ from: jest.fn() });
});

// Helper to create mock Supabase client for addToWaitlist patient lookups
function mockSupabaseForAdd(overrides?: {
	patient?: any;
	procedure?: any;
	dentist?: any;
}) {
	const mock = { from: jest.fn() };
	const createTypedClient = require("@/lib/supabase/typed").createTypedClient;
	(createTypedClient as jest.Mock).mockResolvedValue(mock);
	mock.from
		.mockReturnValueOnce({
			select: () => ({
				eq: () => ({
					single: jest.fn().mockResolvedValue(
						overrides?.patient ?? {
							data: { id: "p1", name: "João", phone: "11999999999" },
							error: null,
						},
					),
				}),
			}),
		})
		.mockReturnValueOnce({
			select: () => ({
				eq: () => ({
					single: jest.fn().mockResolvedValue(
						overrides?.procedure ?? {
							data: { name: "Limpeza" },
							error: null,
						},
					),
				}),
			}),
		})
		.mockReturnValueOnce({
			select: () => ({
				eq: () => ({
					single: jest.fn().mockResolvedValue(
						overrides?.dentist ?? {
							data: { name: "Dr. Silva" },
							error: null,
						},
					),
				}),
			}),
		});
	return mock;
}

describe("Waitlist Service", () => {
	describe("addToWaitlist", () => {
		it("should add patient to waitlist", async () => {
			mockSupabaseForAdd();

			const result = await addToWaitlist({
				clinicId: "c1",
				patientId: "p1",
				preferredDate: "2025-04-15",
				preferredTimeStart: "10:00",
				preferredTimeEnd: "12:00",
				procedureId: "proc1",
				dentistId: "d1",
			});

			expect(result.success).toBe(true);
			expect(result.entry).toBeDefined();
			expect(result.entry!.patientName).toBe("João");
			expect(createWaitlistEntry).toHaveBeenCalled();
		});

		it("should fail when patient not found", async () => {
			const mock = { from: jest.fn() };
			const createTypedClient =
				require("@/lib/supabase/typed").createTypedClient;
			(createTypedClient as jest.Mock).mockResolvedValue(mock);
			mock.from.mockReturnValue({
				select: () => ({
					eq: () => ({
						single: jest
							.fn()
							.mockResolvedValue({
								data: null,
								error: { message: "Not found" },
							}),
					}),
				}),
			});

			const result = await addToWaitlist({
				clinicId: "c1",
				patientId: "nonexistent",
				preferredDate: "2025-04-15",
				preferredTimeStart: "10:00",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Patient not found");
		});

		it("should fail when patient already on waitlist", async () => {
			mockSupabaseForAdd();
			(findByPatientClinicDate as jest.Mock).mockResolvedValueOnce({
				id: "existing-waitlist",
			});

			const result = await addToWaitlist({
				clinicId: "c1",
				patientId: "p1",
				preferredDate: "2025-04-15",
				preferredTimeStart: "10:00",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("already on waitlist");
		});
	});

	describe("getWaitlist", () => {
		it("should return waitlist entries with filters", async () => {
			(findByClinic as jest.Mock).mockResolvedValue([
				{
					id: "w1",
					clinicId: "c1",
					patientId: "p1",
					preferredDate: new Date("2025-04-15T00:00:00Z"),
					preferredTimeStart: "10:00",
					preferredTimeEnd: "12:00",
					dentistId: null,
					priority: 5,
					status: "waiting",
					notes: null,
					createdAt: new Date("2025-04-01T10:00:00Z"),
					updatedAt: null,
				},
			]);

			const result = await getWaitlist("c1", { status: "waiting" });

			expect(result).toHaveLength(1);
			expect(findByClinic).toHaveBeenCalledWith({
				clinicId: "c1",
				status: "waiting",
			});
		});
	});

	describe("findMatchingWaitlist", () => {
		it("should find entries matching a slot", async () => {
			(findMatchingEntries as jest.Mock).mockResolvedValue([
				{
					id: "w1",
					clinicId: "c1",
					patientId: "p1",
					preferredDate: new Date("2025-04-15T00:00:00Z"),
					preferredTimeStart: "09:00",
					preferredTimeEnd: "12:00",
					dentistId: null,
					priority: 8,
					status: "waiting",
					notes: null,
					createdAt: new Date("2025-04-01T10:00:00Z"),
					updatedAt: null,
				},
			]);

			const result = await findMatchingWaitlist("c1", "2025-04-15", "10:00");

			expect(result).toHaveLength(1);
			expect(result[0].priority).toBe(8);
		});

		it("should prioritize specific dentist entries", async () => {
			(findMatchingEntries as jest.Mock).mockResolvedValue([
				{
					id: "w1",
					clinicId: "c1",
					patientId: "p1",
					preferredDate: new Date("2025-04-15T00:00:00Z"),
					preferredTimeStart: "09:00",
					preferredTimeEnd: "12:00",
					dentistId: null,
					priority: 5,
					status: "waiting",
					notes: null,
					createdAt: new Date("2025-04-01T10:00:00Z"),
					updatedAt: null,
				},
				{
					id: "w2",
					clinicId: "c1",
					patientId: "p2",
					preferredDate: new Date("2025-04-15T00:00:00Z"),
					preferredTimeStart: "09:00",
					preferredTimeEnd: "12:00",
					dentistId: "d1",
					priority: 5,
					status: "waiting",
					notes: null,
					createdAt: new Date("2025-04-01T10:00:00Z"),
					updatedAt: null,
				},
			]);

			const result = await findMatchingWaitlist(
				"c1",
				"2025-04-15",
				"10:00",
				"d1",
			);

			// w2 (specific dentist) should come first
			expect(result[0].id).toBe("w1");
		});
	});

	describe("cancelWaitlistEntry", () => {
		it("should cancel entry", async () => {
			(cancelEntry as jest.Mock).mockResolvedValue(true);

			const result = await cancelWaitlistEntry("w1", "Não preciso mais");

			expect(result.success).toBe(true);
			expect(cancelEntry).toHaveBeenCalledWith("w1", "Não preciso mais");
		});

		it("should handle error", async () => {
			(cancelEntry as jest.Mock).mockResolvedValue(false);

			const result = await cancelWaitlistEntry("w1");

			expect(result.success).toBe(false);
		});
	});

	describe("expireOldWaitlistEntries", () => {
		it("should expire old entries", async () => {
			(expireOldEntries as jest.Mock).mockResolvedValue(["w1", "w2"]);

			const result = await expireOldWaitlistEntries();

			expect(result.expired).toBe(2);
		});

		it("should handle error", async () => {
			(expireOldEntries as jest.Mock).mockRejectedValue(new Error("DB error"));

			const result = await expireOldWaitlistEntries();

			expect(result.expired).toBe(0);
		});
	});
});
