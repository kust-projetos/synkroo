/**
 * P1A tenant-negative tests — scoped repository variants must not leak
 * cross-tenant data.
 *
 * Convention: the mocked db resolves `[]` to simulate "id does not belong
 * to this clinic" (scoped WHERE matched nothing) and `[row]` for the
 * same-clinic happy path. Cross-tenant access must surface as
 * null/false (not-found), never as another clinic's row.
 */

let mockChain: any;
let mockDb: any;

function makeChain(value: unknown) {
	const chain: any = {};
	chain.then = (onF: any, onR: any) => Promise.resolve(value).then(onF, onR);
	chain.catch = (onR: any) => Promise.resolve(value).catch(onR);
	for (const m of [
		"select",
		"from",
		"where",
		"limit",
		"offset",
		"orderBy",
		"leftJoin",
		"update",
		"set",
		"delete",
		"insert",
		"values",
		"returning",
		"for",
	]) {
		chain[m] = jest.fn(() => chain);
	}
	return chain;
}

function setDb(value: unknown) {
	mockChain = makeChain(value);
	mockDb = {
		select: jest.fn(() => mockChain),
		update: jest.fn(() => mockChain),
		delete: jest.fn(() => mockChain),
		insert: jest.fn(() => mockChain),
	};
}

jest.mock("@/lib/db/client", () => ({
	getDb: () => mockDb,
	closeDb: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
	dbLogger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
	findByIdScoped as findPatientByIdScoped,
	updateScoped as updatePatientScoped,
	softDeleteScoped as softDeletePatientScoped,
} from "@/repositories/patients";
import {
	findByIdScoped as findAppointmentByIdScoped,
	updateScoped as updateAppointmentScoped,
	updateStatusScoped as updateAppointmentStatusScoped,
	removeScoped as removeAppointmentScoped,
} from "@/repositories/appointments";
import {
	findByIdScoped as findDentistByIdScoped,
	updateScoped as updateDentistScoped,
	removeScoped as removeDentistScoped,
} from "@/repositories/dentists";
import {
	findByIdScoped as findProcedureByIdScoped,
	updateScoped as updateProcedureScoped,
	removeScoped as removeProcedureScoped,
} from "@/repositories/procedures";
import {
	findKnowledgeByIdScoped,
	updateKnowledgeEntryScoped,
	deleteKnowledgeEntryScoped,
} from "@/repositories/knowledge";
import {
	findByIdScoped as findBudgetByIdScoped,
	findByIdWithInstallmentsScoped,
	softDeleteBudgetScoped,
	hardDeleteBudgetScoped,
	updateStatusScoped as updateBudgetStatusScoped,
} from "@/repositories/budgets";
import {
	findWaitlistByIdScoped,
	updateWaitlistScoped,
	cancelWaitlistEntryScoped,
} from "@/modules/operacional/repositories/waitlist-repository";

const clinicA = "clinic-a";
const clinicB = "clinic-b";

beforeEach(() => {
	jest.clearAllMocks();
});

describe("patients — tenant-negative", () => {
	const row = { id: "patient-1", clinicId: clinicA, name: "Paciente A" };
	it("read with wrong clinic returns null (no leak)", async () => {
		setDb([]);
		await expect(findPatientByIdScoped("patient-1", clinicB)).resolves.toBeNull();
		expect(mockChain.where).toHaveBeenCalled();
	});
	it("read with correct clinic returns the row", async () => {
		setDb([row]);
		const got = await findPatientByIdScoped("patient-1", clinicA);
		expect(got?.id).toBe("patient-1");
	});
	it("update with wrong clinic returns null", async () => {
		setDb([]);
		await expect(
			updatePatientScoped("patient-1", clinicB, { name: "Hacker" }),
		).resolves.toBeNull();
	});
	it("update with correct clinic returns the row", async () => {
		setDb([{ ...row, name: "Atualizado" }]);
		const got = await updatePatientScoped("patient-1", clinicA, {
			name: "Atualizado",
		});
		expect(got?.name).toBe("Atualizado");
	});
	it("softDeleteScoped issues a scoped update without throwing", async () => {
		setDb([]);
		await expect(
			softDeletePatientScoped("patient-1", clinicA),
		).resolves.toBeUndefined();
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockChain.where).toHaveBeenCalled();
	});
});

describe("appointments — tenant-negative", () => {
	const row = { id: "appt-1", clinicId: clinicA, status: "scheduled" };
	it("read with wrong clinic returns null (no leak)", async () => {
		setDb([]);
		await expect(findAppointmentByIdScoped("appt-1", clinicB)).resolves.toBeNull();
		expect(mockChain.where).toHaveBeenCalled();
	});
	it("read with correct clinic returns the row", async () => {
		setDb([row]);
		const got = await findAppointmentByIdScoped("appt-1", clinicA);
		expect(got?.id).toBe("appt-1");
	});
	it("update with wrong clinic returns nullish (no write)", async () => {
		setDb([]);
		const got = await updateAppointmentScoped("appt-1", clinicB, {
			notes: "Hacker",
		});
		expect(got == null).toBe(true);
	});
	it("updateStatus with wrong clinic returns nullish (no write)", async () => {
		setDb([]);
		const got = await updateAppointmentStatusScoped(
			"appt-1",
			clinicB,
			"cancelled",
		);
		expect(got == null).toBe(true);
	});
	it("removeScoped issues a scoped update without throwing", async () => {
		setDb([]);
		await expect(removeAppointmentScoped("appt-1", clinicA)).resolves.toBeUndefined();
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockChain.where).toHaveBeenCalled();
	});
});

describe("dentists — tenant-negative", () => {
	const row = { id: "dentist-1", clinicId: clinicA, name: "Dra. A" };
	it("read with wrong clinic returns null (no leak)", async () => {
		setDb([]);
		await expect(findDentistByIdScoped("dentist-1", clinicB)).resolves.toBeNull();
		expect(mockChain.where).toHaveBeenCalled();
	});
	it("read with correct clinic returns the row", async () => {
		setDb([row]);
		const got = await findDentistByIdScoped("dentist-1", clinicA);
		expect(got?.id).toBe("dentist-1");
	});
	it("update with wrong clinic returns nullish (no write)", async () => {
		setDb([]);
		const got = await updateDentistScoped("dentist-1", clinicB, {
			name: "Hacker",
		});
		expect(got == null).toBe(true);
	});
	it("removeScoped issues a scoped update without throwing", async () => {
		setDb([]);
		await expect(removeDentistScoped("dentist-1", clinicA)).resolves.toBeUndefined();
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockChain.where).toHaveBeenCalled();
	});
});

describe("procedures — tenant-negative", () => {
	const row = { id: "proc-1", clinicId: clinicA, name: "Limpeza" };
	it("read with wrong clinic returns null (no leak)", async () => {
		setDb([]);
		await expect(findProcedureByIdScoped("proc-1", clinicB)).resolves.toBeNull();
		expect(mockChain.where).toHaveBeenCalled();
	});
	it("read with correct clinic returns the row", async () => {
		setDb([row]);
		const got = await findProcedureByIdScoped("proc-1", clinicA);
		expect(got?.id).toBe("proc-1");
	});
	it("update with wrong clinic returns nullish (no write)", async () => {
		setDb([]);
		const got = await updateProcedureScoped("proc-1", clinicB, {
			name: "Hacker",
		});
		expect(got == null).toBe(true);
	});
	it("removeScoped issues a scoped update without throwing", async () => {
		setDb([]);
		await expect(removeProcedureScoped("proc-1", clinicA)).resolves.toBeUndefined();
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockChain.where).toHaveBeenCalled();
	});
});

describe("knowledge — tenant-negative", () => {
	const row = { id: "kb-1", clinicId: clinicA, question: "Q?", answer: "A." };
	it("read with wrong clinic returns null (no leak)", async () => {
		setDb([]);
		await expect(findKnowledgeByIdScoped("kb-1", clinicB)).resolves.toBeNull();
		expect(mockChain.where).toHaveBeenCalled();
	});
	it("read with correct clinic returns the row", async () => {
		setDb([row]);
		const got = await findKnowledgeByIdScoped("kb-1", clinicA);
		expect(got?.id).toBe("kb-1");
	});
	it("update with wrong clinic returns null", async () => {
		setDb([]);
		await expect(
			updateKnowledgeEntryScoped("kb-1", clinicB, { answer: "Hacker" }),
		).resolves.toBeNull();
	});
	it("delete with wrong clinic returns false (preserved)", async () => {
		setDb([]);
		await expect(deleteKnowledgeEntryScoped("kb-1", clinicB)).resolves.toBe(false);
	});
	it("delete with correct clinic returns true", async () => {
		setDb([{ id: "kb-1" }]);
		await expect(deleteKnowledgeEntryScoped("kb-1", clinicA)).resolves.toBe(true);
	});
});

describe("budgets — tenant-negative", () => {
	const row = { id: "budget-1", clinicId: clinicA, status: "pending", items: [] };
	it("findById with wrong clinic returns null (no leak)", async () => {
		setDb([]);
		await expect(findBudgetByIdScoped("budget-1", clinicB)).resolves.toBeNull();
		expect(mockChain.where).toHaveBeenCalled();
	});
	it("findById with correct clinic returns the budget", async () => {
		setDb([row]);
		const got = await findBudgetByIdScoped("budget-1", clinicA);
		expect(got?.id).toBe("budget-1");
	});
	it("findByIdWithInstallments with wrong clinic returns null", async () => {
		setDb([]);
		await expect(
			findByIdWithInstallmentsScoped("budget-1", clinicB),
		).resolves.toBeNull();
	});
	it("updateStatus with wrong clinic returns null", async () => {
		setDb([]);
		await expect(
			updateBudgetStatusScoped("budget-1", clinicB, { status: "accepted" }),
		).resolves.toBeNull();
	});
	it("softDelete with wrong clinic returns false (preserved)", async () => {
		setDb([]);
		await expect(softDeleteBudgetScoped("budget-1", clinicB)).resolves.toBe(false);
	});
	it("hardDelete with wrong clinic returns false (preserved)", async () => {
		setDb([]);
		await expect(hardDeleteBudgetScoped("budget-1", clinicB)).resolves.toBe(false);
	});
	it("hardDelete with correct clinic returns true", async () => {
		setDb([{ id: "budget-1" }]);
		await expect(hardDeleteBudgetScoped("budget-1", clinicA)).resolves.toBe(true);
	});
});

describe("waitlist — tenant-negative", () => {
	const row = { id: "wl-1", clinicId: clinicA, status: "waiting" };
	it("read with wrong clinic returns null (no leak)", async () => {
		setDb([]);
		await expect(findWaitlistByIdScoped("wl-1", clinicB)).resolves.toBeNull();
		expect(mockChain.where).toHaveBeenCalled();
	});
	it("read with correct clinic returns the row", async () => {
		setDb([row]);
		const got = await findWaitlistByIdScoped("wl-1", clinicA);
		expect(got?.id).toBe("wl-1");
	});
	it("update with wrong clinic returns null", async () => {
		setDb([]);
		await expect(
			updateWaitlistScoped("wl-1", clinicB, { priority: 99 }),
		).resolves.toBeNull();
	});
	it("cancel with wrong clinic returns null (preserved)", async () => {
		setDb([]);
		await expect(cancelWaitlistEntryScoped("wl-1", clinicB)).resolves.toBeNull();
	});
	it("cancel with correct clinic returns the row", async () => {
		setDb([{ ...row, status: "cancelled" }]);
		const got = await cancelWaitlistEntryScoped("wl-1", clinicA, "sem interesse");
		expect(got?.status).toBe("cancelled");
	});
});
