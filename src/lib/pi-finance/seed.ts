// AUTO-GENERATED from tmp/pi-finance-localstorage.json on 2026-07-05.
// Source: https://pi-finance-pwa.walissonead.workers.dev/ snapshot 2026-07-05.
// Do NOT hand-edit the data exports — regenerate via `npx tsx src/lib/pi-finance/_gen-seed.ts`.

import type { FinanceData, FinanceSnapshot } from './types'

export const PI_FINANCE_TOKEN = "cee1a6d7-77f7-4efb-a2a0-06877f6026ea"

// Fixed reference date for deterministic snapshot-locked computations
// (cash-burn 30d window, next-payable due-days). Mirrors the captured
// localStorage snapshot timestamp so the seed's relative-time values
// (R$ 1.553,60 burn, "5 dias", etc.) remain stable regardless of when
// the suite runs. Source: tmp/pi-finance-localstorage.json snapshot 2026-07-05.
export const PI_FINANCE_NOW = new Date('2026-07-05T12:18:08.349Z')

const HOUSEHOLD_ID = "550e8400-e29b-41d4-a716-446655440000"

export const initialFinanceData: FinanceData = {
  accounts: [
  {
    "id": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Conta Corrente Nubank",
    "kind": "bank",
    "balanceCents": 609770,
    "status": "active"
  },
  {
    "id": "4a526f0f-eaa6-4187-baff-1f1516c81a5e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Poupança Nubank",
    "kind": "bank",
    "balanceCents": 1439500,
    "status": "active"
  },
  {
    "id": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Conta Corrente Itaú",
    "kind": "bank",
    "balanceCents": 514910,
    "status": "active"
  },
  {
    "id": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "VR Refeição",
    "kind": "bank",
    "balanceCents": 264600,
    "status": "active"
  },
  {
    "id": "97bb202d-36b1-4e1a-9140-19e4db18287e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PicPay",
    "kind": "bank",
    "balanceCents": 18750,
    "status": "active"
  },
  {
    "id": "91e8805d-7c89-4596-a1c1-b24bb06a736a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Cartão Nubank",
    "kind": "credit_card",
    "balanceCents": 665750,
    "status": "active",
    "creditLimitCents": 800000,
    "closingDay": 5,
    "dueDay": 13
  },
  {
    "id": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Carteira",
    "kind": "bank",
    "balanceCents": 107540,
    "status": "active"
  },
  {
    "id": "814332c4-cc5a-4369-9141-09564d8aebc3",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Cartão Itaú",
    "kind": "credit_card",
    "balanceCents": -56000,
    "status": "active",
    "creditLimitCents": 500000,
    "closingDay": 20,
    "dueDay": 28
  }
] as FinanceData['accounts'],
  categories: [
  {
    "id": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alimentação > Mercado",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "55389108-c723-493d-b378-4b672076173f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alimentação > Restaurante",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "577b7e45-6ee9-47dc-bf83-4063199b3d93",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alimentação > iFood",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "0462fabd-4f72-4171-8c89-aa15b89ca27e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alimentação > Padaria",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "ef0aa79e-1e92-4987-8fd3-84ba4c13caab",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alimentação > Lanche",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "7ddcf4f7-4466-453c-a942-e43f76fea733",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alimentação > Café",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "38894402-7927-44da-b2eb-343ab691e05e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Moradia > Aluguel",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "eb8790a2-c3b6-4c0c-a00e-bf62d6f5d59a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Moradia > Condomínio",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "8f3dbe02-f7d3-4213-822e-725bfea175db",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Moradia > Água",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "aee00981-b48d-4628-9586-dc73c85e154b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Moradia > Luz",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "7af4e10a-3e35-414c-adc4-02de7d1f476a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Moradia > Internet",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "785898b4-bff8-483f-81b4-6404acdc7339",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Transporte > Gasolina",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "c08a8753-e520-4090-a8b5-17395efe5da2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Transporte > Uber",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "6109dc30-4d83-4f4a-b480-dbc974be216a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Transporte > Ônibus",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "08791d5b-d48f-4e96-85be-c0a8fc4c08fc",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Transporte > Estacionamento",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "b402a624-d63c-4789-aa36-77b8ad8a023f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Saúde > Plano de Saúde",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "f127f698-9ae3-4bb1-a734-afea930e01fa",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Saúde > Farmácia",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "2a0f91de-563e-40f5-a8ca-b26107cd6003",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Saúde > Academia",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "068522f1-8c5e-45b1-ab82-fa8a59f4bc3b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Saúde > Dentista",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "64aca7e6-fdf4-4dca-b37a-b525c92bb6fe",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Educação > Curso",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "f9b3d6e5-b0ec-4419-991d-7c9938e6d4f2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Educação > Livros",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "e2ab2524-406f-4b47-a712-74335036ec5f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Lazer > Cinema",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "f2e03785-3c7a-4b8e-a568-543e892e505f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Lazer > Streaming",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "a9835cd3-92b0-4ca4-8afd-41ce672973b1",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Lazer > Viagem",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "850edab0-3faf-4233-8afb-f4f8cf94fb7a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Lazer > Bar",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "8b12dbdc-cd9e-4971-8606-dcdb9b2b0db1",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Compras > Roupa",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "5817c198-41a2-4625-a341-3f8a2dfb5376",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Compras > Eletrônicos",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "b0d4fefc-4372-4f61-9b46-8929f52b4d9d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Compras > Decoração",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "0bf8fbc9-859a-4f24-8bcd-2f5567d39a4c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Compras > Presentes",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "d67f9f7c-ad0a-477a-a3df-35c339503253",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Assinaturas > Netflix",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "3a2efdf0-9dde-4f6a-9082-9ffb8b85004b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Assinaturas > Spotify",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "4c5dcd5f-3dea-4fe0-b69b-1c537c08c79c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Assinaturas > Amazon Prime",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "29fca3ed-f510-4be9-849c-deeec3ca128b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Outros > Pets",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "c90bdaa4-62f6-482e-a7d1-daf800f2d892",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Outros > Cabelereiro",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "a7ab3110-f705-4ab3-b3a1-70c411cac55d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Outros > Seguro",
    "kind": "expense",
    "status": "active"
  },
  {
    "id": "4c69f480-e040-4cdf-89f8-fc61528a83f2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Renda > Salário",
    "kind": "income",
    "status": "active"
  },
  {
    "id": "ca69cc0f-e61a-4828-9e85-293f9dec07da",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Renda > Freelance",
    "kind": "income",
    "status": "active"
  },
  {
    "id": "50e12c30-2324-4496-9507-86a4b16739d4",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Renda > Investimentos",
    "kind": "income",
    "status": "active"
  },
  {
    "id": "89f2f8d8-ca3e-40e7-bf39-bf20e830f103",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Renda > Restituição",
    "kind": "income",
    "status": "active"
  }
] as FinanceData['categories'],
  transactions: [
  {
    "id": "4f594b34-5367-4509-a116-b9337a51fc4a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Seguro Auto",
    "amountCents": 24500,
    "date": "2026-07-04",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "a7ab3110-f705-4ab3-b3a1-70c411cac55d"
  },
  {
    "id": "4d52a286-cbd3-450b-acbb-d4c65683b7b1",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "carne",
    "amountCents": 56000,
    "date": "2026-06-26",
    "accountId": "814332c4-cc5a-4369-9141-09564d8aebc3",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "a33ba1eb-2df1-4355-996c-08de90a00601",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Roupa - Renner",
    "amountCents": 13500,
    "date": "2026-06-25",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "8b12dbdc-cd9e-4971-8606-dcdb9b2b0db1"
  },
  {
    "id": "1332f3f5-d878-4544-9cc4-c6076930bd1b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Uber",
    "amountCents": 1950,
    "date": "2026-06-24",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "c08a8753-e520-4090-a8b5-17395efe5da2"
  },
  {
    "id": "332c133f-392d-4555-a5b2-8c447a450c33",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Livros",
    "amountCents": 8970,
    "date": "2026-06-23",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "f9b3d6e5-b0ec-4419-991d-7c9938e6d4f2"
  },
  {
    "id": "c0b80362-8a1c-4f74-8daa-0110ec438328",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "iFood - Burguer",
    "amountCents": 3690,
    "date": "2026-06-22",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "577b7e45-6ee9-47dc-bf83-4063199b3d93"
  },
  {
    "id": "6c077ce4-1cf4-4b15-8b80-da85cf59fd7e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Estacionamento",
    "amountCents": 1800,
    "date": "2026-06-21",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "08791d5b-d48f-4e96-85be-c0a8fc4c08fc"
  },
  {
    "id": "9d844fbd-9120-4149-8efe-bd135992b84d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 850,
    "date": "2026-06-20",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "61d841fa-f9fb-457a-942e-20fd82b3cad3",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Decoração",
    "amountCents": 8900,
    "date": "2026-06-19",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "b0d4fefc-4372-4f61-9b46-8929f52b4d9d"
  },
  {
    "id": "51c2ca1a-3764-4b0a-be24-355324c124a9",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 1200,
    "date": "2026-06-18",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "0b6d8717-8f0f-4919-ae74-d970a822ee95",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "iFood - Açaí",
    "amountCents": 2850,
    "date": "2026-06-18",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "577b7e45-6ee9-47dc-bf83-4063199b3d93"
  },
  {
    "id": "e8b3acdf-009c-4dc3-a2eb-cd8629b03c7b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 3500,
    "date": "2026-06-17",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "90bf365c-36c0-4ab9-aab6-b6311f3353f2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Assaí",
    "amountCents": 27650,
    "date": "2026-06-16",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "e49148d5-1553-4265-b087-b6f5b3d117d6",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "PicPay - Recarga",
    "amountCents": 10000,
    "date": "2026-06-15",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "97bb202d-36b1-4e1a-9140-19e4db18287e"
  },
  {
    "id": "cfeebe52-1db2-4456-a8bf-1e8a0918ac5b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Restituição IR",
    "amountCents": 345000,
    "date": "2026-06-15",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "89f2f8d8-ca3e-40e7-bf39-bf20e830f103"
  },
  {
    "id": "a223c3bd-df6d-44c1-9967-b30e4ed6e7db",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Farmácia",
    "amountCents": 2780,
    "date": "2026-06-15",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "f127f698-9ae3-4bb1-a734-afea930e01fa"
  },
  {
    "id": "3e3bb1e5-c4a2-4361-9e6e-0e63423ce4a9",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Cabelereiro",
    "amountCents": 5500,
    "date": "2026-06-14",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "c90bdaa4-62f6-482e-a7d1-daf800f2d892"
  },
  {
    "id": "f4781499-1a4d-45fa-9770-d28b7e0863f2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Cartão - Pagamento Fatura Junho",
    "amountCents": 92400,
    "date": "2026-06-13",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a"
  },
  {
    "id": "304a3d51-1ef4-422c-8f74-1b812cb7c8c2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Bar",
    "amountCents": 5200,
    "date": "2026-06-13",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "850edab0-3faf-4233-8afb-f4f8cf94fb7a"
  },
  {
    "id": "e9a56036-e593-49a3-8c66-f77f3dc27fcc",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Luz",
    "amountCents": 12750,
    "date": "2026-06-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "aee00981-b48d-4628-9586-dc73c85e154b"
  },
  {
    "id": "dd5e5ae4-cec5-460d-8d6e-177b9abd40db",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Conta de Água (conta paga)",
    "amountCents": 5890,
    "date": "2026-06-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "8f3dbe02-f7d3-4213-822e-725bfea175db"
  },
  {
    "id": "cd6bdc50-f121-49ee-8bbc-12d32587f290",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Água",
    "amountCents": 5890,
    "date": "2026-06-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "8f3dbe02-f7d3-4213-822e-725bfea175db"
  },
  {
    "id": "a8b68d2c-465a-4b28-baf5-85054b7f38ae",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Amazon Prime",
    "amountCents": 1990,
    "date": "2026-06-12",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "4c5dcd5f-3dea-4fe0-b69b-1c537c08c79c"
  },
  {
    "id": "475a732c-f83d-469d-b884-2d74b9a95f2e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Energia Elétrica (conta paga)",
    "amountCents": 13200,
    "date": "2026-06-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "aee00981-b48d-4628-9586-dc73c85e154b"
  },
  {
    "id": "ad22f678-f498-4c4a-aa1c-d13fe8ca0f9a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Gasolina",
    "amountCents": 19200,
    "date": "2026-06-11",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "785898b4-bff8-483f-81b4-6404acdc7339"
  },
  {
    "id": "c3a18632-174d-4db5-a013-9237dc0e534f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 920,
    "date": "2026-06-10",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "c2af907a-e9c6-4baf-98d7-f3a310dccefd",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Netflix",
    "amountCents": 5590,
    "date": "2026-06-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "d67f9f7c-ad0a-477a-a3df-35c339503253"
  },
  {
    "id": "b4909d1d-96e7-4b12-95e0-c072cf593f02",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Internet",
    "amountCents": 9990,
    "date": "2026-06-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "7af4e10a-3e35-414c-adc4-02de7d1f476a"
  },
  {
    "id": "635a5dfb-177f-4a93-a6dd-84719480ce10",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Spotify",
    "amountCents": 2190,
    "date": "2026-06-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "3a2efdf0-9dde-4f6a-9082-9ffb8b85004b"
  },
  {
    "id": "4b29a1cb-42ee-4b47-b317-b799e0c5e46d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Internet (conta paga)",
    "amountCents": 9990,
    "date": "2026-06-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "7af4e10a-3e35-414c-adc4-02de7d1f476a"
  },
  {
    "id": "d5dfa85f-4875-4be0-b06e-fadf889e8764",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 4200,
    "date": "2026-06-09",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "90009123-5ecb-49f2-8f65-97c0cdf85f7d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Plano de Saúde",
    "amountCents": 42500,
    "date": "2026-06-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "b402a624-d63c-4789-aa36-77b8ad8a023f"
  },
  {
    "id": "1de3a018-4c5e-41c9-9593-fc4dfb395474",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Uber",
    "amountCents": 3500,
    "date": "2026-06-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "c08a8753-e520-4090-a8b5-17395efe5da2"
  },
  {
    "id": "04a561f6-09dd-4e78-9bbb-93b5d47a01e7",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Plano de Saúde (conta paga)",
    "amountCents": 42500,
    "date": "2026-06-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "b402a624-d63c-4789-aa36-77b8ad8a023f"
  },
  {
    "id": "9501d3e2-b1c5-4a30-979c-ef20caf68f5e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Investimento Poupança - Junho",
    "amountCents": 50000,
    "date": "2026-06-06",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "4a526f0f-eaa6-4187-baff-1f1516c81a5e"
  },
  {
    "id": "fc219f80-b1a6-4323-97e6-2b9df7307244",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Aluguel",
    "amountCents": 180000,
    "date": "2026-06-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "38894402-7927-44da-b2eb-343ab691e05e"
  },
  {
    "id": "ec115571-fef9-40e6-8c68-0aae51abd0c9",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Condomínio",
    "amountCents": 45000,
    "date": "2026-06-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "eb8790a2-c3b6-4c0c-a00e-bf62d6f5d59a"
  },
  {
    "id": "9fb24d20-8a48-4e21-92e3-3cac581b6fc1",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Salário - Junho",
    "amountCents": 695000,
    "date": "2026-06-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "4c69f480-e040-4cdf-89f8-fc61528a83f2"
  },
  {
    "id": "8f9aafd3-bf4e-45d4-a649-7b572714b5a7",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Condomínio (conta paga)",
    "amountCents": 45000,
    "date": "2026-06-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "eb8790a2-c3b6-4c0c-a00e-bf62d6f5d59a"
  },
  {
    "id": "1486fdc6-d32b-4a92-8ea3-baa042ade892",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Aluguel (conta paga)",
    "amountCents": 180000,
    "date": "2026-06-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "38894402-7927-44da-b2eb-343ab691e05e"
  },
  {
    "id": "31f2bbf3-abbf-4170-880f-fa78f4a7282b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 980,
    "date": "2026-06-04",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "003f46f8-33b7-487d-8eb7-eb467764c920",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Ônibus",
    "amountCents": 440,
    "date": "2026-06-03",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "6109dc30-4d83-4f4a-b480-dbc974be216a"
  },
  {
    "id": "e532a17f-151a-45fa-88a5-19898915b1ec",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Carrefour",
    "amountCents": 39800,
    "date": "2026-06-02",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "ddfa3fe3-942e-4176-b644-e9a3b579c34d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Academia",
    "amountCents": 9900,
    "date": "2026-06-01",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "2a0f91de-563e-40f5-a8ca-b26107cd6003"
  },
  {
    "id": "cdf22bb4-37c9-488f-a580-dc47c25e48b9",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Recarga VR - Junho",
    "amountCents": 60000,
    "date": "2026-06-01",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79"
  },
  {
    "id": "68c12073-4811-459f-988d-b18fc5a25b7e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Dividendos",
    "amountCents": 14100,
    "date": "2026-06-01",
    "accountId": "4a526f0f-eaa6-4187-baff-1f1516c81a5e",
    "categoryId": "50e12c30-2324-4496-9507-86a4b16739d4"
  },
  {
    "id": "2246e1df-efd9-4818-99d9-57fcc2230d82",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 890,
    "date": "2026-05-25",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "130ea9cb-df0d-4f35-bc25-500b1591eff3",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Uber",
    "amountCents": 2200,
    "date": "2026-05-23",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "c08a8753-e520-4090-a8b5-17395efe5da2"
  },
  {
    "id": "caf66791-a0f6-4953-a1d8-91ca59dcaac2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Lanche",
    "amountCents": 1650,
    "date": "2026-05-22",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "ef0aa79e-1e92-4987-8fd3-84ba4c13caab"
  },
  {
    "id": "6823560c-5812-41a4-9d37-0549d4d79465",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 3800,
    "date": "2026-05-21",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "a233925f-d83f-49f2-929e-e4ae546758f4",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Farmácia",
    "amountCents": 2150,
    "date": "2026-05-20",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "f127f698-9ae3-4bb1-a734-afea930e01fa"
  },
  {
    "id": "6847b9aa-4e06-4af2-ac6f-4cb074b16570",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Freela - Consultoria",
    "amountCents": 220000,
    "date": "2026-05-20",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "ca69cc0f-e61a-4828-9e85-293f9dec07da"
  },
  {
    "id": "19098b7c-1806-426a-94de-0381a77465ff",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Pets - Veterinário",
    "amountCents": 14500,
    "date": "2026-05-20",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "29fca3ed-f510-4be9-849c-deeec3ca128b"
  },
  {
    "id": "d54429b2-c137-4729-802c-99708ab3891d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Estacionamento",
    "amountCents": 1500,
    "date": "2026-05-19",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "08791d5b-d48f-4e96-85be-c0a8fc4c08fc"
  },
  {
    "id": "9d2791ee-cee4-4150-9b73-5b06999deb0d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Assaí",
    "amountCents": 31200,
    "date": "2026-05-17",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "6ef9c4b4-dd87-4750-8f2a-3d57524ff014",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Eletrônicos - Fone de Ouvido",
    "amountCents": 29900,
    "date": "2026-05-16",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "5817c198-41a2-4625-a341-3f8a2dfb5376"
  },
  {
    "id": "540dd73b-72d8-423d-bc32-822fa7f8ce02",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "iFood - Pizza",
    "amountCents": 4290,
    "date": "2026-05-15",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "577b7e45-6ee9-47dc-bf83-4063199b3d93"
  },
  {
    "id": "e1188d07-6556-4bfa-90bc-44368f29ba50",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 1480,
    "date": "2026-05-14",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "c576d8ec-13b5-4a11-9a29-e5c478af5175",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 4100,
    "date": "2026-05-14",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "65144699-e17c-470a-a3c5-24e6a2f7aa41",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Cartão - Pagamento Fatura Maio",
    "amountCents": 460460,
    "date": "2026-05-13",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a"
  },
  {
    "id": "06f82576-24bd-4368-ab03-fd0253394426",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Pets - Ração",
    "amountCents": 8900,
    "date": "2026-05-13",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "29fca3ed-f510-4be9-849c-deeec3ca128b"
  },
  {
    "id": "b4e8a653-6e91-496f-b2a7-1cc798cca282",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Gasolina",
    "amountCents": 16900,
    "date": "2026-05-12",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "785898b4-bff8-483f-81b4-6404acdc7339"
  },
  {
    "id": "9f6992c5-e9df-480c-9db0-e536952c7df0",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Água",
    "amountCents": 5120,
    "date": "2026-05-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "8f3dbe02-f7d3-4213-822e-725bfea175db"
  },
  {
    "id": "998cc963-4712-4598-893a-01b15c755ad4",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Luz",
    "amountCents": 13200,
    "date": "2026-05-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "aee00981-b48d-4628-9586-dc73c85e154b"
  },
  {
    "id": "e1de00eb-d3a5-479d-92cf-626b0e8deff2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 780,
    "date": "2026-05-11",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "7e2b870f-dcfe-462d-b949-390eb435d342",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Netflix",
    "amountCents": 5590,
    "date": "2026-05-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "d67f9f7c-ad0a-477a-a3df-35c339503253"
  },
  {
    "id": "33d322ca-a13c-4f34-8294-23b4f83fc3e2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Spotify",
    "amountCents": 2190,
    "date": "2026-05-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "3a2efdf0-9dde-4f6a-9082-9ffb8b85004b"
  },
  {
    "id": "33474c30-7cfe-47c6-bd0c-906edbbb385b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Internet",
    "amountCents": 9990,
    "date": "2026-05-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "7af4e10a-3e35-414c-adc4-02de7d1f476a"
  },
  {
    "id": "d2f0dc9d-d077-402d-90f6-4736ccfe26ad",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Uber",
    "amountCents": 2780,
    "date": "2026-05-09",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "c08a8753-e520-4090-a8b5-17395efe5da2"
  },
  {
    "id": "488d621a-3340-4bb4-97aa-efcb2c7cda39",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Plano de Saúde",
    "amountCents": 42500,
    "date": "2026-05-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "b402a624-d63c-4789-aa36-77b8ad8a023f"
  },
  {
    "id": "1a732ee4-7a5e-47ec-aef2-bafc5b810298",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Presente Dia das Mães",
    "amountCents": 15000,
    "date": "2026-05-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "0bf8fbc9-859a-4f24-8bcd-2f5567d39a4c"
  },
  {
    "id": "89d632c7-2042-4a54-97ed-2a4ab416d274",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 3500,
    "date": "2026-05-07",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "df6bd801-85a0-43e4-b52c-cf70c11a85d0",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Investimento Poupança - Maio",
    "amountCents": 50000,
    "date": "2026-05-06",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "4a526f0f-eaa6-4187-baff-1f1516c81a5e"
  },
  {
    "id": "e8d4acb0-f544-4ef1-8240-beb01fb29660",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Salário - Maio",
    "amountCents": 685000,
    "date": "2026-05-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "4c69f480-e040-4cdf-89f8-fc61528a83f2"
  },
  {
    "id": "d4a7f81c-f77b-4377-a485-ca4a79bdef5b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 1050,
    "date": "2026-05-05",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "537982ed-a0dd-46e8-903e-9a36d261fc72",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Ônibus",
    "amountCents": 440,
    "date": "2026-05-05",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "6109dc30-4d83-4f4a-b480-dbc974be216a"
  },
  {
    "id": "12393bde-5180-4e16-b6c6-fca3633c7d88",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Condomínio",
    "amountCents": 45000,
    "date": "2026-05-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "eb8790a2-c3b6-4c0c-a00e-bf62d6f5d59a"
  },
  {
    "id": "0011efe4-1115-46e1-be76-b0fcf277da7e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Aluguel",
    "amountCents": 180000,
    "date": "2026-05-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "38894402-7927-44da-b2eb-343ab691e05e"
  },
  {
    "id": "a035bd45-8773-4a72-b040-4f962328fbba",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Extra",
    "amountCents": 36540,
    "date": "2026-05-03",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "ce3e9421-6254-4515-a944-e3359acadda0",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Academia",
    "amountCents": 9900,
    "date": "2026-05-01",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "2a0f91de-563e-40f5-a8ca-b26107cd6003"
  },
  {
    "id": "75854226-8548-4329-80bc-d974f4d0a5ef",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Recarga VR - Maio",
    "amountCents": 60000,
    "date": "2026-05-01",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79"
  },
  {
    "id": "626587e5-dc68-45e7-9810-c8fa368ddda7",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Dividendos",
    "amountCents": 13400,
    "date": "2026-05-01",
    "accountId": "4a526f0f-eaa6-4187-baff-1f1516c81a5e",
    "categoryId": "50e12c30-2324-4496-9507-86a4b16739d4"
  },
  {
    "id": "b3e2dcf1-8ac3-411f-8dfa-512fdec8c76c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Bar",
    "amountCents": 4500,
    "date": "2026-04-25",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "850edab0-3faf-4233-8afb-f4f8cf94fb7a"
  },
  {
    "id": "996542bb-fb68-499a-9d6b-292535aea544",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Uber",
    "amountCents": 1850,
    "date": "2026-04-22",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "c08a8753-e520-4090-a8b5-17395efe5da2"
  },
  {
    "id": "31e6b65b-63d6-4d92-a6a2-40ae3cf350f2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Dentista",
    "amountCents": 18000,
    "date": "2026-04-22",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "068522f1-8c5e-45b1-ab82-fa8a59f4bc3b"
  },
  {
    "id": "79b9be5c-2237-4cb7-99d5-ded33c66a565",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Cinema",
    "amountCents": 3200,
    "date": "2026-04-20",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "e2ab2524-406f-4b47-a712-74335036ec5f"
  },
  {
    "id": "6cc74966-c63d-4cd9-bccc-06b57213ad5a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "iFood - Japonês",
    "amountCents": 5890,
    "date": "2026-04-19",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "577b7e45-6ee9-47dc-bf83-4063199b3d93"
  },
  {
    "id": "bd8dabbf-16e1-426d-9aa3-2308fdf7e31d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Roupa - Renner",
    "amountCents": 18900,
    "date": "2026-04-18",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "8b12dbdc-cd9e-4971-8606-dcdb9b2b0db1"
  },
  {
    "id": "1b1fa383-9cff-49b9-b830-19d346f96fa7",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Assaí",
    "amountCents": 28900,
    "date": "2026-04-18",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "5a55e024-11c9-4aa2-8498-9210fffea261",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 920,
    "date": "2026-04-17",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "552aa896-85d3-4219-b4b8-a8cf2e965c7b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 4600,
    "date": "2026-04-16",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "f601afaf-688a-45c1-90d0-8eeeebf1a1f6",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Freela - Site WordPress",
    "amountCents": 150000,
    "date": "2026-04-15",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "ca69cc0f-e61a-4828-9e85-293f9dec07da"
  },
  {
    "id": "7e9fcb12-af49-4291-b281-0becced1dbb7",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Curso Online",
    "amountCents": 29700,
    "date": "2026-04-15",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "64aca7e6-fdf4-4dca-b37a-b525c92bb6fe"
  },
  {
    "id": "cca227e4-c2af-4f8f-90d4-b4030834f315",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Farmácia",
    "amountCents": 3280,
    "date": "2026-04-14",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "f127f698-9ae3-4bb1-a734-afea930e01fa"
  },
  {
    "id": "7eb25a36-9cd1-4727-865d-1b61d91f35ac",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Cartão - Pagamento Fatura Abril",
    "amountCents": 112890,
    "date": "2026-04-13",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a"
  },
  {
    "id": "111df1c2-2ef1-494a-9185-4075e2bde50b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Ônibus",
    "amountCents": 440,
    "date": "2026-04-13",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "6109dc30-4d83-4f4a-b480-dbc974be216a"
  },
  {
    "id": "fdb8602c-8209-4696-9815-2f557d134d37",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Luz",
    "amountCents": 11890,
    "date": "2026-04-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "aee00981-b48d-4628-9586-dc73c85e154b"
  },
  {
    "id": "b8d105a2-21ab-4044-a8c5-a0d714745ae8",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Água",
    "amountCents": 5430,
    "date": "2026-04-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "8f3dbe02-f7d3-4213-822e-725bfea175db"
  },
  {
    "id": "b2d26207-99cd-4cc1-93b4-1ad217b1b89a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Amazon Prime",
    "amountCents": 1990,
    "date": "2026-04-12",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "4c5dcd5f-3dea-4fe0-b69b-1c537c08c79c"
  },
  {
    "id": "2a01fba8-a64b-402d-90ae-b657d449002d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 1350,
    "date": "2026-04-12",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "224e009e-67ad-433b-a87e-0853c4296cca",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Lanche",
    "amountCents": 1850,
    "date": "2026-04-11",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "ef0aa79e-1e92-4987-8fd3-84ba4c13caab"
  },
  {
    "id": "fdac3673-dd1e-4d33-b8f8-0c1c7ab7f01d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Gasolina",
    "amountCents": 18200,
    "date": "2026-04-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "785898b4-bff8-483f-81b4-6404acdc7339"
  },
  {
    "id": "e51a3bee-ad00-4794-89df-6101794f4e61",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Internet",
    "amountCents": 9990,
    "date": "2026-04-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "7af4e10a-3e35-414c-adc4-02de7d1f476a"
  },
  {
    "id": "1df7e371-4f2c-4dba-8ad3-ba0a104a1d6a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Spotify",
    "amountCents": 2190,
    "date": "2026-04-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "3a2efdf0-9dde-4f6a-9082-9ffb8b85004b"
  },
  {
    "id": "0f949e04-d336-4c00-b554-4d391e823d9c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Netflix",
    "amountCents": 5590,
    "date": "2026-04-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "d67f9f7c-ad0a-477a-a3df-35c339503253"
  },
  {
    "id": "cf95b3a0-42c3-4c73-ab2a-b205e7343eb7",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 3850,
    "date": "2026-04-09",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "ef1a9d3d-4c06-49f8-8135-003f5ecb3e36",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Plano de Saúde",
    "amountCents": 42500,
    "date": "2026-04-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "b402a624-d63c-4789-aa36-77b8ad8a023f"
  },
  {
    "id": "ee62dcef-881b-4e9f-9699-7644e63d923f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 890,
    "date": "2026-04-08",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "f3c59d7a-b1bd-4a9d-8461-6c6226218766",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Uber",
    "amountCents": 3200,
    "date": "2026-04-07",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "c08a8753-e520-4090-a8b5-17395efe5da2"
  },
  {
    "id": "84b61502-ffc7-497f-b99c-bc1fcfca1405",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Investimento Poupança - Abril",
    "amountCents": 50000,
    "date": "2026-04-06",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "4a526f0f-eaa6-4187-baff-1f1516c81a5e"
  },
  {
    "id": "f446dc97-a469-4298-95af-a283ec6b8f25",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Carrefour",
    "amountCents": 42180,
    "date": "2026-04-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "8f5ec82d-492b-45ed-bf62-0cbfd1145213",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Salário - Abril",
    "amountCents": 685000,
    "date": "2026-04-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "4c69f480-e040-4cdf-89f8-fc61528a83f2"
  },
  {
    "id": "6cde3a3b-416f-44d5-8b45-ee1384663ac5",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Condomínio",
    "amountCents": 45000,
    "date": "2026-04-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "eb8790a2-c3b6-4c0c-a00e-bf62d6f5d59a"
  },
  {
    "id": "1d59b577-e594-473a-8eb3-12f471a2076c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Aluguel",
    "amountCents": 180000,
    "date": "2026-04-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "38894402-7927-44da-b2eb-343ab691e05e"
  },
  {
    "id": "ea194ca8-fcf5-4040-8fd8-a56b0fdbf39a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 1120,
    "date": "2026-04-03",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "a80a9fa0-0786-420c-8bdb-07c1d5a47a27",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "transfer",
    "description": "Recarga VR - Abril",
    "amountCents": 60000,
    "date": "2026-04-01",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "transferToAccountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79"
  },
  {
    "id": "49777901-1898-48c0-b159-e0b15bbfa3df",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Academia",
    "amountCents": 9900,
    "date": "2026-04-01",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "2a0f91de-563e-40f5-a8ca-b26107cd6003"
  },
  {
    "id": "38f94d12-e57a-4d71-8525-6876b12c09ec",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Dividendos",
    "amountCents": 12000,
    "date": "2026-04-01",
    "accountId": "4a526f0f-eaa6-4187-baff-1f1516c81a5e",
    "categoryId": "50e12c30-2324-4496-9507-86a4b16739d4"
  },
  {
    "id": "70b902c9-d5ef-4045-a356-b22ab0c26061",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Estacionamento",
    "amountCents": 1200,
    "date": "2026-03-22",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "08791d5b-d48f-4e96-85be-c0a8fc4c08fc"
  },
  {
    "id": "5cbd4028-d72d-42d6-bd3d-bafeb48310b1",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "iFood - Pizza",
    "amountCents": 4590,
    "date": "2026-03-20",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "577b7e45-6ee9-47dc-bf83-4063199b3d93"
  },
  {
    "id": "1036d094-c5fc-46d3-82a5-c9d75c018a92",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 920,
    "date": "2026-03-19",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "09921c9b-1b6c-4ef5-98a8-6e3e4b96de21",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 4200,
    "date": "2026-03-18",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "61a63d76-bf32-4643-ac01-ef2005cf498a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Lanche",
    "amountCents": 1580,
    "date": "2026-03-16",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "ef0aa79e-1e92-4987-8fd3-84ba4c13caab"
  },
  {
    "id": "bbecf947-b1d0-4fad-aeeb-3223a05beca9",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Seguro Auto",
    "amountCents": 24500,
    "date": "2026-03-15",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "a7ab3110-f705-4ab3-b3a1-70c411cac55d"
  },
  {
    "id": "a6c1d342-71dc-49a3-a658-8c4f628cc899",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Assaí",
    "amountCents": 34520,
    "date": "2026-03-15",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "f42d5b2e-ca9b-4ee7-bb61-44ea35dcf212",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "iFood - Hamburguer",
    "amountCents": 3250,
    "date": "2026-03-14",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "577b7e45-6ee9-47dc-bf83-4063199b3d93"
  },
  {
    "id": "826d116e-6447-4c35-8822-7a276495981a",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Luz",
    "amountCents": 12350,
    "date": "2026-03-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "aee00981-b48d-4628-9586-dc73c85e154b"
  },
  {
    "id": "572e5423-cab6-4d08-926f-8d3a7d74e343",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Restaurante - Almoço",
    "amountCents": 3650,
    "date": "2026-03-12",
    "accountId": "a9dd76df-59aa-4750-8eb3-7d6ba8ef5e79",
    "categoryId": "55389108-c723-493d-b378-4b672076173f"
  },
  {
    "id": "098cabc0-a248-4fcd-ac71-60510149e672",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Água",
    "amountCents": 5670,
    "date": "2026-03-12",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "categoryId": "8f3dbe02-f7d3-4213-822e-725bfea175db"
  },
  {
    "id": "2a37806d-9f36-44ba-9f34-d98b8980016b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Internet",
    "amountCents": 9990,
    "date": "2026-03-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "7af4e10a-3e35-414c-adc4-02de7d1f476a"
  },
  {
    "id": "0e83a923-aa82-4cdf-b8a7-8e60955115e4",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Spotify",
    "amountCents": 2190,
    "date": "2026-03-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "3a2efdf0-9dde-4f6a-9082-9ffb8b85004b"
  },
  {
    "id": "0a2bcc25-d072-40f2-b3aa-5ca007b705fe",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Netflix",
    "amountCents": 5590,
    "date": "2026-03-10",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "d67f9f7c-ad0a-477a-a3df-35c339503253"
  },
  {
    "id": "050fb9ae-dc5d-47d8-b7f4-c6c7c6559152",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 980,
    "date": "2026-03-10",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "6683773a-9de4-4d53-8ef0-fb653bda62fa",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Farmácia",
    "amountCents": 4560,
    "date": "2026-03-09",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "f127f698-9ae3-4bb1-a734-afea930e01fa"
  },
  {
    "id": "e837177f-fdfe-492b-920c-f86da3159fe4",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Gasolina",
    "amountCents": 17200,
    "date": "2026-03-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "785898b4-bff8-483f-81b4-6404acdc7339"
  },
  {
    "id": "156d808b-8279-4157-a237-acdc0624e2d1",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Plano de Saúde",
    "amountCents": 42500,
    "date": "2026-03-08",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "b402a624-d63c-4789-aa36-77b8ad8a023f"
  },
  {
    "id": "80882324-f189-4e12-80ee-fc6929af644d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Café",
    "amountCents": 780,
    "date": "2026-03-07",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "7ddcf4f7-4466-453c-a942-e43f76fea733"
  },
  {
    "id": "2876f47c-beb5-437a-b566-2228021c4e74",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Uber",
    "amountCents": 2450,
    "date": "2026-03-06",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "c08a8753-e520-4090-a8b5-17395efe5da2"
  },
  {
    "id": "55b2166d-deef-47e6-8d90-72c8354b689e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "income",
    "description": "Salário - Março",
    "amountCents": 680000,
    "date": "2026-03-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "4c69f480-e040-4cdf-89f8-fc61528a83f2"
  },
  {
    "id": "370b927f-6b96-45dd-ab28-467d303da819",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Condomínio",
    "amountCents": 45000,
    "date": "2026-03-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "eb8790a2-c3b6-4c0c-a00e-bf62d6f5d59a"
  },
  {
    "id": "2bdc3b4d-9550-47a8-8785-2a409a30434e",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Aluguel",
    "amountCents": 180000,
    "date": "2026-03-05",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "38894402-7927-44da-b2eb-343ab691e05e"
  },
  {
    "id": "621d20b8-df7d-4ae3-92f5-4c9a8d92891c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Padaria",
    "amountCents": 1250,
    "date": "2026-03-04",
    "accountId": "a9af7892-1984-4846-8a0b-e09079aff7a0",
    "categoryId": "0462fabd-4f72-4171-8c89-aa15b89ca27e"
  },
  {
    "id": "f82f210a-3549-4685-b919-b1bb1b511dfc",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Supermercado Extra",
    "amountCents": 28750,
    "date": "2026-03-03",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d"
  },
  {
    "id": "c7d76c37-14c4-49ba-8b28-1fc7a55498a0",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "expense",
    "description": "Academia",
    "amountCents": 9900,
    "date": "2026-03-01",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "categoryId": "2a0f91de-563e-40f5-a8ca-b26107cd6003"
  }
] as FinanceData['transactions'],
  payables: [
  {
    "id": "f6f350a6-eb3a-446f-9c49-7d83a9a2c343",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "description": "Aluguel",
    "amountCents": 180000,
    "dueDate": "2026-06-05",
    "type": "one_time",
    "status": "paid",
    "paidDate": "2026-06-05",
    "reminderDaysBefore": 3,
    "notes": "Apartamento - julho",
    "categoryId": "38894402-7927-44da-b2eb-343ab691e05e"
  },
  {
    "id": "4e731a80-d207-42f1-8939-2d3c053927c9",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "description": "Condomínio",
    "amountCents": 45000,
    "dueDate": "2026-06-05",
    "type": "one_time",
    "status": "paid",
    "paidDate": "2026-06-05",
    "reminderDaysBefore": 3,
    "notes": "Condomínio julho",
    "categoryId": "eb8790a2-c3b6-4c0c-a00e-bf62d6f5d59a"
  },
  {
    "id": "8f805ebe-fa25-49c2-8260-467184d6cf4c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "description": "Plano de Saúde",
    "amountCents": 42500,
    "dueDate": "2026-06-08",
    "type": "one_time",
    "status": "paid",
    "paidDate": "2026-06-08",
    "reminderDaysBefore": 3,
    "notes": "Unimed Nacional",
    "categoryId": "b402a624-d63c-4789-aa36-77b8ad8a023f"
  },
  {
    "id": "a7a8c888-7e08-43df-b783-e47ac1508d49",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "9680dea2-9dbf-4da7-ba8d-f91816c640ab",
    "description": "Internet",
    "amountCents": 9990,
    "dueDate": "2026-06-10",
    "type": "one_time",
    "status": "paid",
    "paidDate": "2026-06-10",
    "reminderDaysBefore": 3,
    "notes": "Internet fibra 500MB",
    "categoryId": "7af4e10a-3e35-414c-adc4-02de7d1f476a"
  },
  {
    "id": "fddd9bf6-920f-4900-be43-e06f2589ab56",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "description": "Energia Elétrica",
    "amountCents": 13200,
    "dueDate": "2026-06-12",
    "type": "one_time",
    "status": "paid",
    "paidDate": "2026-06-12",
    "reminderDaysBefore": 3,
    "notes": "Conta de luz - maio",
    "categoryId": "aee00981-b48d-4628-9586-dc73c85e154b"
  },
  {
    "id": "46f00ba5-df19-46db-827e-276bbec8b7b8",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "description": "Conta de Água",
    "amountCents": 5890,
    "dueDate": "2026-06-12",
    "type": "one_time",
    "status": "paid",
    "paidDate": "2026-06-12",
    "reminderDaysBefore": 3,
    "notes": "Conta de água - maio",
    "categoryId": "8f3dbe02-f7d3-4213-822e-725bfea175db"
  },
  {
    "id": "09c20621-6478-4a82-a4b9-a657a5aa2fab",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "description": "Seguro Auto",
    "amountCents": 24500,
    "dueDate": "2026-07-15",
    "type": "one_time",
    "status": "paid",
    "paidDate": "2026-07-04",
    "reminderDaysBefore": 3,
    "notes": "Seguro Porto Seguro",
    "categoryId": "a7ab3110-f705-4ab3-b3a1-70c411cac55d"
  },
  {
    "id": "9b493eac-9e9d-47fd-8a5b-ce4eda76715c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "074d86a9-9528-43f6-b947-e35e0c85a024",
    "description": "Curso Online",
    "amountCents": 29700,
    "dueDate": "2026-07-20",
    "type": "one_time",
    "status": "pending",
    "reminderDaysBefore": 3,
    "notes": "Parcela do curso",
    "categoryId": "64aca7e6-fdf4-4dca-b37a-b525c92bb6fe"
  }
] as FinanceData['payables'],
  budgets: [
  {
    "id": "0d3c7960-bfe2-4490-8e4f-e18215b1ddfe",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "categoryId": "28d08efa-c5dd-4e5e-b8b6-fb03593c651d",
    "name": "Alimentação (Mercado)",
    "amountCents": 160000,
    "period": "monthly",
    "startDate": "2026-03-01",
    "alertThreshold": 80,
    "rollover": false,
    "spentCents": 0,
    "remainingCents": 160000,
    "percentUsed": 0
  },
  {
    "id": "95a418b0-4f04-4071-8887-d3e4d4f5a274",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "categoryId": "55389108-c723-493d-b378-4b672076173f",
    "name": "Restaurante",
    "amountCents": 40000,
    "period": "monthly",
    "startDate": "2026-03-01",
    "alertThreshold": 80,
    "rollover": false,
    "spentCents": 0,
    "remainingCents": 40000,
    "percentUsed": 0
  },
  {
    "id": "66b7c649-a4ae-438a-b29c-81210e7db854",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "categoryId": "785898b4-bff8-483f-81b4-6404acdc7339",
    "name": "Transporte",
    "amountCents": 40000,
    "period": "monthly",
    "startDate": "2026-03-01",
    "alertThreshold": 80,
    "rollover": false,
    "spentCents": 0,
    "remainingCents": 40000,
    "percentUsed": 0
  },
  {
    "id": "9bbd5138-036a-497f-8f8f-77e31aaf9b15",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "categoryId": "577b7e45-6ee9-47dc-bf83-4063199b3d93",
    "name": "Delivery (iFood)",
    "amountCents": 20000,
    "period": "monthly",
    "startDate": "2026-03-01",
    "alertThreshold": 80,
    "rollover": false,
    "spentCents": 0,
    "remainingCents": 20000,
    "percentUsed": 0
  },
  {
    "id": "57cd7e9b-8b0d-48e3-b36d-06a59c4eb423",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "categoryId": "850edab0-3faf-4233-8afb-f4f8cf94fb7a",
    "name": "Lazer",
    "amountCents": 20000,
    "period": "monthly",
    "startDate": "2026-03-01",
    "alertThreshold": 80,
    "rollover": false,
    "spentCents": 0,
    "remainingCents": 20000,
    "percentUsed": 0
  },
  {
    "id": "0d57dbba-fd27-4a70-b9e0-e3f3eefc9eb1",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "categoryId": "f127f698-9ae3-4bb1-a734-afea930e01fa",
    "name": "Farmácia",
    "amountCents": 15000,
    "period": "monthly",
    "startDate": "2026-03-01",
    "alertThreshold": 80,
    "rollover": false,
    "spentCents": 0,
    "remainingCents": 15000,
    "percentUsed": 0
  },
  {
    "id": "fb3fee63-b95e-4445-b46f-08d8bc1cb8f4",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "categoryId": "d67f9f7c-ad0a-477a-a3df-35c339503253",
    "name": "Assinaturas",
    "amountCents": 12000,
    "period": "monthly",
    "startDate": "2026-03-01",
    "alertThreshold": 80,
    "rollover": false,
    "spentCents": 0,
    "remainingCents": 12000,
    "percentUsed": 0
  }
] as FinanceData['budgets'],
  goals: [
  {
    "id": "15dace91-c37a-462f-a810-68f106c5f9da",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Trocar de Carro",
    "goalType": "savings",
    "targetAmountCents": 5000000,
    "currentAmountCents": 0,
    "startDate": "2026-06-01",
    "status": "active"
  },
  {
    "id": "f2a47f42-d57b-47cd-a1f4-1980ebbe2a7f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "MacBook Novo",
    "goalType": "purchase",
    "targetAmountCents": 1800000,
    "currentAmountCents": 350000,
    "startDate": "2026-03-01",
    "status": "active"
  },
  {
    "id": "b78b19fa-07ec-4057-924f-014425c5c03d",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Viagem para Europa",
    "goalType": "savings",
    "targetAmountCents": 1500000,
    "currentAmountCents": 1050000,
    "startDate": "2026-01-01",
    "status": "active"
  },
  {
    "id": "25822136-5370-4cb8-9b10-f3e07eb173bb",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Reserva de Emergência",
    "goalType": "emergency_fund",
    "targetAmountCents": 1200000,
    "currentAmountCents": 600000,
    "startDate": "2026-01-01",
    "status": "active"
  }
] as FinanceData['goals'],
  cardStatements: [
  {
    "id": "7cec4788-f509-47d8-b4ec-70e295479c3b",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "814332c4-cc5a-4369-9141-09564d8aebc3",
    "cycleYearMonth": "2026-07",
    "closingDate": "2026-07-20",
    "dueDate": "2026-07-28",
    "totalCents": 0,
    "paidCents": 0,
    "status": "open"
  },
  {
    "id": "86c386a3-f1a8-4e93-a23d-28e430da9e8f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a",
    "cycleYearMonth": "2026-07",
    "closingDate": "2026-07-05",
    "dueDate": "2026-07-13",
    "totalCents": 77740,
    "paidCents": 0,
    "status": "open"
  },
  {
    "id": "13772d67-edee-4a9b-b006-7db1024d5eb2",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "814332c4-cc5a-4369-9141-09564d8aebc3",
    "cycleYearMonth": "2026-06",
    "closingDate": "2026-06-20",
    "dueDate": "2026-06-28",
    "totalCents": 44400,
    "paidCents": 0,
    "status": "closed"
  },
  {
    "id": "db03a393-ef5f-4909-93d9-9e7ba5bdab76",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a",
    "cycleYearMonth": "2026-06",
    "closingDate": "2026-06-05",
    "dueDate": "2026-06-13",
    "totalCents": 162730,
    "paidCents": 0,
    "status": "open"
  },
  {
    "id": "9be52ac4-3c55-4bca-a55f-d26affc89d79",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "814332c4-cc5a-4369-9141-09564d8aebc3",
    "cycleYearMonth": "2026-05",
    "closingDate": "2026-05-20",
    "dueDate": "2026-05-28",
    "totalCents": 36400,
    "paidCents": 36400,
    "status": "paid"
  },
  {
    "id": "0478c43b-cb4c-4736-b364-834cbac7b78c",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a",
    "cycleYearMonth": "2026-05",
    "closingDate": "2026-05-05",
    "dueDate": "2026-05-13",
    "totalCents": 462850,
    "paidCents": 462850,
    "status": "paid"
  },
  {
    "id": "cf6eab4c-1693-497c-8e88-0a07b7061bbc",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "814332c4-cc5a-4369-9141-09564d8aebc3",
    "cycleYearMonth": "2026-04",
    "closingDate": "2026-04-20",
    "dueDate": "2026-04-28",
    "totalCents": 27700,
    "paidCents": 27700,
    "status": "paid"
  },
  {
    "id": "bd20d40b-b24f-4d45-853b-3c68bf0360aa",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a",
    "cycleYearMonth": "2026-04",
    "closingDate": "2026-04-05",
    "dueDate": "2026-04-13",
    "totalCents": 130860,
    "paidCents": 130860,
    "status": "paid"
  },
  {
    "id": "787c5dcd-aa1f-4637-ab28-6d9b7d2d1c6f",
    "householdId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "91e8805d-7c89-4596-a1c1-b24bb06a736a",
    "cycleYearMonth": "2026-03",
    "closingDate": "2026-03-05",
    "dueDate": "2026-03-13",
    "totalCents": 72360,
    "paidCents": 72360,
    "status": "paid"
  }
] as FinanceData['cardStatements'],
}

const SYNCED_AT: FinanceSnapshot['syncedAt'] = {
  "accounts": "2026-07-05T12:18:08.349Z",
  "categories": "2026-07-05T12:18:08.349Z",
  "transactions": "2026-07-05T12:18:08.349Z",
  "payables": "2026-07-05T12:18:08.350Z",
  "budgets": "2026-07-05T12:18:08.350Z",
  "goals": "2026-07-05T12:18:08.350Z",
  "cardStatements": "2026-07-05T12:18:08.351Z"
} as FinanceSnapshot['syncedAt']

const SNAPSHOT_VERSION = 1 as const

/**
 * Build the immutable snapshot the rest of the app reads.
 * Deterministic given the seed; pass `now` only if you want a custom syncedAt.
 */
export function createInitialSnapshot(now: Date = new Date()): FinanceSnapshot {
  const ts = now.toISOString()
  const syncedAt: FinanceSnapshot['syncedAt'] = {
    accounts: ts,
    categories: ts,
    transactions: ts,
    payables: ts,
    budgets: ts,
    goals: ts,
    cardStatements: ts,
  }
  // Reference the original syncedAt for reference but recompute for the build moment.
  void SYNCED_AT
  void SNAPSHOT_VERSION
  void HOUSEHOLD_ID
  return {
    version: 1,
    token: PI_FINANCE_TOKEN,
    syncedAt,
    data: initialFinanceData,
  }
}
