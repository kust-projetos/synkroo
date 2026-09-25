/**
 * Tests for Budget Service
 * Covers calculateBudgetTotals (pure), createBudget, getBudgetById, updateBudgetStatus, deleteBudget, getBudgetStats
 */

import {
	calculateBudgetTotals,
	createBudget,
	getBudgetById,
	updateBudgetStatus,
	deleteBudget,
	getBudgetStats,
	getBudgetWithInstallments,
} from "../budget.service";

// Mock the budgets repository
jest.mock("@/repositories/budgets", () => ({
	createWithItems: jest.fn(),
	findById: jest.fn(),
	updateStatus: jest.fn(),
	hardDeleteBudget: jest.fn(),
	softDeleteBudget: jest.fn(),
	getStatsByClinic: jest.fn(),
	findByIdWithInstallments: jest.fn(),
}));

const mockRepo = jest.mocked(require("@/repositories/budgets"));

beforeEach(() => {
	jest.clearAllMocks();
});

describe("Budget Service", () => {
	describe("calculateBudgetTotals (pure)", () => {
		it("should calculate totals for single item without discount", () => {
			const items = [{ quantity: 2, unit_price: 100, discount_percent: 0 }];
			const result = calculateBudgetTotals(items);

			expect(result.total_value).toBe(200);
			expect(result.discount_value).toBe(0);
			expect(result.final_value).toBe(200);
		});

		it("should calculate totals with item-level discount", () => {
			const items = [{ quantity: 1, unit_price: 200, discount_percent: 10 }];
			const result = calculateBudgetTotals(items);

			expect(result.total_value).toBe(180);
			expect(result.discount_value).toBe(0);
			expect(result.final_value).toBe(180);
		});

		it("should calculate totals with overall discount", () => {
			const items = [{ quantity: 1, unit_price: 100, discount_percent: 0 }];
			const result = calculateBudgetTotals(items, 20);

			expect(result.total_value).toBe(100);
			expect(result.discount_value).toBe(20);
			expect(result.final_value).toBe(80);
		});

		it("should calculate totals with both item and overall discount", () => {
			const items = [{ quantity: 2, unit_price: 100, discount_percent: 10 }];
			const result = calculateBudgetTotals(items, 15);

			// item total: 2 * 100 = 200, item disc 10% = 20, total = 180
			// overall disc: 180 * 15% = 27
			// final: 180 - 27 = 153
			expect(result.total_value).toBe(180);
			expect(result.discount_value).toBe(27);
			expect(result.final_value).toBe(153);
		});

		it("should handle multiple items correctly", () => {
			const items = [
				{ quantity: 1, unit_price: 100, discount_percent: 0 },
				{ quantity: 2, unit_price: 50, discount_percent: 0 },
			];
			const result = calculateBudgetTotals(items);

			expect(result.total_value).toBe(200);
			expect(result.final_value).toBe(200);
		});

		it("should round to 2 decimal places", () => {
			const items = [{ quantity: 3, unit_price: 33.33, discount_percent: 0 }];
			const result = calculateBudgetTotals(items);

			// 3 * 33.33 = 99.99
			expect(result.total_value).toBe(99.99);
			expect(result.final_value).toBe(99.99);
		});

		it("precisão: 3 × 0.1 totaliza exatamente 0.30 (sem 0.30000000000000004)", () => {
			const result = calculateBudgetTotals([
				{ quantity: 3, unit_price: 0.1, discount_percent: 0 },
			]);

			expect(result.total_value).toBe(0.3);
			expect(result.final_value).toBe(0.3);
		});

		it("precisão: 0.1 + 0.2 totaliza exatamente 0.30", () => {
			const result = calculateBudgetTotals([
				{ quantity: 1, unit_price: 0.1, discount_percent: 0 },
				{ quantity: 1, unit_price: 0.2, discount_percent: 0 },
			]);

			expect(result.total_value).toBe(0.3);
			expect(result.final_value).toBe(0.3);
		});

		it("precisão: preço 1.005 é quantizado para 1.01 (10 × 1.005 → 10.10)", () => {
			const result = calculateBudgetTotals([
				{ quantity: 10, unit_price: 1.005, discount_percent: 0 },
			]);

			expect(result.total_value).toBe(10.1);
			expect(result.final_value).toBe(10.1);
		});
	});

	describe("createBudget", () => {
		it("should create budget with items", async () => {
			const mockBudget = {
				id: "budget-1",
				clinicId: "c1",
				patientId: "p1",
				status: "pending",
				totalValue: "100",
				discountPercent: "0",
				discountValue: "0",
				finalValue: "100",
			};
			const mockItems = [
				{
					id: "item-1",
					budgetId: "budget-1",
					procedureId: null,
					procedureName: "Limpeza",
					quantity: 1,
					unitPrice: "100",
					discountPercent: "0",
					totalPrice: "100",
					notes: null,
					createdAt: new Date(),
				},
			];

			mockRepo.createWithItems.mockResolvedValue({
				budget: mockBudget as any,
				items: mockItems as any,
			});

			const result = await createBudget({
				clinic_id: "c1",
				patient_id: "p1",
				items: [
					{
						procedure_name: "Limpeza",
						quantity: 1,
						unit_price: 100,
						discount_percent: 0,
						total_price: 100,
					},
				],
			});

			expect(result.id).toBe("budget-1");
			expect(result.items).toHaveLength(1);
		});

		it("persiste linhas QUANTIZADAS que somam o total (10.005 → 10.01, 20.005 → 20.01)", async () => {
			let captured: any = null;
			mockRepo.createWithItems.mockImplementation(async (data: any) => {
				captured = data;
				return {
					budget: {
						id: "budget-q",
						clinicId: "c1",
						patientId: "p1",
						status: "pending",
						totalValue: data.totalValue,
						discountPercent: "0",
						discountValue: "0",
						finalValue: data.finalValue,
					},
					items: data.items.map((it: any, i: number) => ({
						id: `item-q${i}`,
						budgetId: "budget-q",
						procedureId: it.procedureId,
						procedureName: it.procedureName,
						quantity: it.quantity,
						unitPrice: it.unitPrice,
						discountPercent: it.discountPercent,
						totalPrice: it.totalPrice,
						notes: null,
						createdAt: new Date(),
					})),
				} as any;
			});

			const result = await createBudget({
				clinic_id: "c1",
				patient_id: "p1",
				items: [
					{
						procedure_name: "A",
						quantity: 1,
						unit_price: 10.005,
						discount_percent: 0,
						total_price: 10.005,
					},
					{
						procedure_name: "B",
						quantity: 1,
						unit_price: 20.005,
						discount_percent: 0,
						total_price: 20.005,
					},
				],
			});

			// Valores quantizados na borda de persistência (não os originais).
			expect(captured.items.map((i: any) => i.unitPrice)).toEqual([
				"10.01",
				"20.01",
			]);
			expect(captured.items.map((i: any) => i.totalPrice)).toEqual([
				"10.01",
				"20.01",
			]);
			// Leitura pós-gravação: soma dos itens == total persistido.
			const sumItems = result
				.items!.reduce((s, it) => s + Math.round(it.total_price * 100), 0);
			expect(sumItems).toBe(Math.round(result.total_value * 100));
			expect(result.total_value).toBe(30.02);
		});

		it("should throw on budget creation error", async () => {
			mockRepo.createWithItems.mockRejectedValue(new Error("DB error"));

			await expect(
				createBudget({
					clinic_id: "c1",
					patient_id: "p1",
					items: [],
				}),
			).rejects.toThrow("Failed to create budget");
		});

		it("should cleanup budget when items fail", async () => {			mockRepo.hardDeleteBudget.mockResolvedValue();
			mockRepo.createWithItems.mockImplementation(async (_data: any) => {
				throw new Error("Items error");
			});

			await expect(
				createBudget({
					clinic_id: "c1",
					patient_id: "p1",
					items: [
						{
							procedure_name: "Limpeza",
							quantity: 1,
							unit_price: 100,
							discount_percent: 0,
							total_price: 100,
						},
					],
				}),
			).rejects.toThrow("Failed to create budget");
		});
	});

	describe("getBudgetById", () => {
		it("should return budget with patient and items", async () => {
			const mockData = {
				id: "b1",
				clinicId: "c1",
				patientId: "p1",
				patient: { id: "p1", name: "João", phone: "11999999999" },
				items: [
					{
						id: "i1",
						budgetId: "b1",
						procedureId: null,
						procedureName: "Limpeza",
						quantity: 1,
						unitPrice: "100",
						discountPercent: "0",
						totalPrice: "100",
						notes: null,
						createdAt: new Date(),
					},
				],
				status: "pending",
				totalValue: "100",
				discountPercent: "0",
				discountValue: "0",
				finalValue: "100",
			};

			mockRepo.findById.mockResolvedValue(mockData as any);

			const result = await getBudgetById("b1");
			expect(result).not.toBeNull();
			expect(result!.id).toBe("b1");
		});

		it("should return null on error", async () => {
			mockRepo.findById.mockResolvedValue(null);

			const result = await getBudgetById("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("updateBudgetStatus", () => {
		it("should update status with metadata", async () => {
			const mockUpdated = {
				id: "b1",
				status: "accepted",
				clinicId: "c1",
				patientId: "p1",
			};

			mockRepo.updateStatus.mockResolvedValue(mockUpdated as any);

			const result = await updateBudgetStatus("b1", "accepted", {
				responded_at: new Date().toISOString(),
			});

			expect(result).not.toBeNull();
			expect(result!.status).toBe("accepted");
		});

		it("should return null on error", async () => {
			mockRepo.updateStatus.mockResolvedValue(null);

			const result = await updateBudgetStatus("b1", "accepted");
			expect(result).toBeNull();
		});
	});

	describe("deleteBudget", () => {
		it("should soft delete by default", async () => {
			mockRepo.softDeleteBudget.mockResolvedValue();

			const result = await deleteBudget("b1");
			expect(result).toBe(true);
			expect(mockRepo.softDeleteBudget).toHaveBeenCalledWith("b1");
		});

		it("should hard delete when specified", async () => {
			mockRepo.hardDeleteBudget.mockResolvedValue();

			const result = await deleteBudget("b1", true);
			expect(result).toBe(true);
			expect(mockRepo.hardDeleteBudget).toHaveBeenCalledWith("b1");
		});
	});

	describe("getBudgetStats", () => {
		it("should calculate stats from budgets", async () => {
			const mockData = [
				{ status: "pending", finalValue: "100" },
				{ status: "sent", finalValue: "200" },
				{ status: "accepted", finalValue: "150" },
				{ status: "rejected", finalValue: "50" },
				{ status: "converted", finalValue: "300" },
			];

			mockRepo.getStatsByClinic.mockResolvedValue(mockData as any);

			const stats = await getBudgetStats("c1");

			expect(stats.total).toBe(5);
			expect(stats.pending).toBe(1);
			expect(stats.converted).toBe(1);
			expect(stats.total_value).toBe(800);
			// conversion_rate = converted / (accepted + rejected + converted) * 100 = 1/3 * 100
			expect(stats.conversion_rate).toBeCloseTo(33.33, 1);
		});

		it("should return zeros on error", async () => {
			mockRepo.getStatsByClinic.mockRejectedValue(new Error("DB error"));

			const stats = await getBudgetStats("c1");
			expect(stats.total).toBe(0);
			expect(stats.conversion_rate).toBe(0);
		});

		it("precisão: total_value soma em centavos (0.10 + 0.20 = 0.30 exato)", async () => {
			mockRepo.getStatsByClinic.mockResolvedValue([
				{ status: "accepted", finalValue: "0.10" },
				{ status: "accepted", finalValue: "0.20" },
			] as any);

			const stats = await getBudgetStats("c1");

			expect(stats.total_value).toBe(0.3);
		});
	});
});

describe("getBudgetWithInstallments (precisão)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("mapeia installments em centavos exatos (0.10 → 0.1)", async () => {
		mockRepo.findByIdWithInstallments.mockResolvedValue({
			id: "b1",
			clinicId: "c1",
			patientId: "p1",
			status: "pending",
			totalValue: "0.30",
			discountPercent: "0",
			discountValue: "0",
			finalValue: "0.30",
			items: [],
			installments: [
				{ id: "i1", budgetId: "b1", amount: "0.10", dueDate: new Date(), status: "pending", paidAt: null, paymentId: null },
				{ id: "i2", budgetId: "b1", amount: "0.20", dueDate: new Date(), status: "pending", paidAt: null, paymentId: null },
			],
		} as any);

		const result = await getBudgetWithInstallments("b1");

		expect(result).not.toBeNull();
		expect(result!.final_value).toBe(0.3);
		expect(result!.installments!.map((i) => i.amount)).toEqual([0.1, 0.2]);
	});
});
