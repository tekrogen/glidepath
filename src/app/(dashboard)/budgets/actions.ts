"use server";

/**
 * Budget server actions — create, update, delete.
 * Spent is recomputed from this month's transactions on every mutation.
 */

import { revalidatePath } from "next/cache";
import { BudgetPeriod } from "@prisma/client";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/constants";
import { prisma } from "@/lib/db/prisma";

async function requireFinancialWrite() {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    throw new Error("Not authorized");
  }
  return session.user.id;
}

async function computeSpent(userId: string, category: string, start: Date, end: Date) {
  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      category,
      type: "EXPENSE",
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return Math.abs(Number(agg._sum.amount ?? 0));
}

function currentMonthBounds() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export async function createBudget(formData: FormData) {
  const userId = await requireFinancialWrite();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount"));

  if (!name || !category || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Name, category, and a positive amount are required.");
  }

  const { start, end } = currentMonthBounds();
  const spent = await computeSpent(userId, category, start, end);

  await prisma.budget.create({
    data: {
      userId,
      name,
      category,
      amount,
      spent,
      period: BudgetPeriod.MONTHLY,
      startDate: start,
      endDate: end,
    },
  });

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

export async function updateBudget(formData: FormData) {
  const userId = await requireFinancialWrite();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount"));

  if (!id || !name || !category || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Name, category, and a positive amount are required.");
  }

  const budget = await prisma.budget.findFirst({ where: { id, userId } });
  if (!budget) {
    throw new Error("Budget not found.");
  }

  const spent = await computeSpent(userId, category, budget.startDate, budget.endDate);

  await prisma.budget.update({
    where: { id },
    data: { name, category, amount, spent },
  });

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

export async function deleteBudget(formData: FormData) {
  const userId = await requireFinancialWrite();
  const id = String(formData.get("id") ?? "");

  const budget = await prisma.budget.findFirst({ where: { id, userId } });
  if (!budget) {
    throw new Error("Budget not found.");
  }

  await prisma.budget.delete({ where: { id } });

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}
