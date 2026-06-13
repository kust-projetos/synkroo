/**
 * Tests for Appointment Actions Service
 * Tests cancel, reschedule, confirm, and no-show flows
 */

import {
	getAppointmentInfo,
	confirmAppointment,
	cancelAppointment,
	rescheduleAppointment,
	markNoShow,
} from "../appointment-actions.service";

// Mock the appointments repository
jest.mock("@/repositories/appointments", () => ({
	findById: jest.fn(),
	updateStatus: jest.fn(),
	update: jest.fn(),
	rescheduleAppointmentSlot: jest.fn(),
}));

// Mock the waitlist service
jest.mock("@/services/waitlist/waitlist.service", () => ({
	processWaitlistOnCancellation: jest.fn().mockResolvedValue({ notified: 0 }),
}));

// Mock fetch for WhatsApp notifications
global.fetch = jest.fn().mockResolvedValue({ ok: true });

const {
	findById,
	updateStatus,
	update,
	rescheduleAppointmentSlot,
} = require("@/repositories/appointments");

beforeEach(() => {
	jest.resetAllMocks();

	// Reconfigure waitlist mock after reset
	const {
		processWaitlistOnCancellation,
	} = require("@/services/waitlist/waitlist.service");
	processWaitlistOnCancellation.mockResolvedValue({ notified: 0 });

	// Default repository mock setup
	(findById as jest.Mock).mockResolvedValue(null);
	(updateStatus as jest.Mock).mockResolvedValue({ id: "apt-123" });
	(update as jest.Mock).mockResolvedValue({ id: "apt-123" });
	(rescheduleAppointmentSlot as jest.Mock).mockResolvedValue({ success: true });
});

describe("Appointment Actions Service", () => {
	const mockAppointment = {
		id: "apt-123",
		clinic_id: "clinic-123",
		patient_id: "patient-123",
		dentist_id: "dentist-123",
		scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
		duration_minutes: 60,
		status: "scheduled",
		patients: { id: "patient-123", name: "João Silva", phone: "11999999999" },
		dentists: { name: "Dra. Maria" },
		procedures: { name: "Limpeza" },
	};

	describe("getAppointmentInfo", () => {
		it("should return appointment info from repository", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
				dentistId: "dentist-123",
			});

			const info = await getAppointmentInfo("apt-123");

			expect(info).not.toBeNull();
			expect(info!.id).toBe("apt-123");
			expect(info!.clinicId).toBe("clinic-123");
			expect(info!.status).toBe("scheduled");
		});

		it("should return null on error", async () => {
			(findById as jest.Mock).mockResolvedValue(null);

			const info = await getAppointmentInfo("nonexistent");

			expect(info).toBeNull();
		});
	});

	describe("confirmAppointment", () => {
		it("should confirm a scheduled appointment", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
			});
			(updateStatus as jest.Mock).mockResolvedValue({ id: "apt-123" });

			const result = await confirmAppointment("apt-123", "clinic");

			expect(result.success).toBe(true);
		});

		it("should fail for non-scheduled appointments", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "confirmed",
			});

			const result = await confirmAppointment("apt-123");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Only scheduled appointments");
		});

		it("should fail for non-existent appointment", async () => {
			(findById as jest.Mock).mockResolvedValue(null);

			const result = await confirmAppointment("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Appointment not found");
		});

		it("should accept different confirmation sources", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
			});
			(updateStatus as jest.Mock).mockResolvedValue({ id: "apt-123" });

			const result = await confirmAppointment("apt-123", "whatsapp");

			expect(result.success).toBe(true);
		});
	});

	describe("cancelAppointment", () => {
		it("should cancel a scheduled appointment", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
			});
			(updateStatus as jest.Mock).mockResolvedValue({ id: "apt-123" });

			const result = await cancelAppointment("apt-123", "Patient requested");

			expect(result.success).toBe(true);
		});

		it("should fail for completed appointments", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "completed",
			});

			const result = await cancelAppointment("apt-123");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Only scheduled or confirmed");
		});

		it("should return waitlist notified count", async () => {
			const {
				processWaitlistOnCancellation,
			} = require("@/services/waitlist/waitlist.service");
			processWaitlistOnCancellation.mockResolvedValueOnce({ notified: 2 });

			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
			});
			(updateStatus as jest.Mock).mockResolvedValue({ id: "apt-123" });

			const result = await cancelAppointment("apt-123");

			expect(result.success).toBe(true);
			expect(result.waitlistNotified).toBe(2);
		});
	});

	describe("rescheduleAppointment", () => {
		it("should reschedule to a new valid time", async () => {
			const newDate = new Date(Date.now() + 172800000); // 2 days from now
			const dateStr = newDate.toISOString().split("T")[0];
			const timeStr = "10:00";

			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
				dentistId: "dentist-123",
			});
			(rescheduleAppointmentSlot as jest.Mock).mockResolvedValue({
				success: true,
			});

			const result = await rescheduleAppointment("apt-123", dateStr, timeStr);

			expect(result.success).toBe(true);
			expect(result.newScheduledAt).toBeDefined();
		});

		it("should fail for past dates", async () => {
			const pastDate = "2020-01-01";
			const pastTime = "10:00";

			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
				dentistId: "dentist-123",
			});

			const result = await rescheduleAppointment("apt-123", pastDate, pastTime);

			expect(result.success).toBe(false);
			expect(result.error).toContain("futuros");
		});

		it("should fail on schedule conflict", async () => {
			const newDate = new Date(Date.now() + 172800000);
			const dateStr = newDate.toISOString().split("T")[0];
			const timeStr = "10:00";

			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
				dentistId: "dentist-123",
			});
			(rescheduleAppointmentSlot as jest.Mock).mockResolvedValue({
				success: false,
				error: "Horário não disponível para este profissional.",
			});

			const result = await rescheduleAppointment("apt-123", dateStr, timeStr);

			expect(result.success).toBe(false);
			expect(result.error).toContain("não disponível");
		});
	});

	describe("markNoShow", () => {
		it("should mark scheduled appointment as no-show", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "scheduled",
			});
			(updateStatus as jest.Mock).mockResolvedValue({ id: "apt-123" });

			const result = await markNoShow("apt-123");

			expect(result.success).toBe(true);
		});

		it("should fail for already completed appointments", async () => {
			(findById as jest.Mock).mockResolvedValue({
				id: "apt-123",
				clinicId: "clinic-123",
				patientId: "patient-123",
				scheduledAt: new Date(mockAppointment.scheduled_at),
				durationMinutes: 60,
				status: "completed",
			});

			const result = await markNoShow("apt-123");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Only scheduled or confirmed");
		});
	});
});
