"use client";

/**
 * Create/edit budget dialog. Submits to server actions; closes on submit.
 */

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBudget, updateBudget } from "./actions";

export const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Transportation",
  "Travel",
  "Food & Dining",
  "Healthcare",
  "Personal & Family",
  "Business Expenses",
  "Financial",
  "Other Expenses",
];

interface BudgetFormDialogProps {
  budget?: {
    id: string;
    name: string;
    category: string;
    amount: number;
  };
}

export function BudgetFormDialog({ budget }: BudgetFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(budget?.category ?? "");
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(budget);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      if (isEdit) {
        await updateBudget(formData);
      } else {
        await createBudget(formData);
      }
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit budget</span>
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New budget
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "Create budget"}</DialogTitle>
          <DialogDescription>
            Budgets track spending against a monthly limit for a category.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {budget && <input type="hidden" name="id" value={budget.id} />}
          <div className="space-y-1">
            <Label htmlFor="budget-name">Name</Label>
            <Input
              id="budget-name"
              name="name"
              defaultValue={budget?.name}
              placeholder="e.g. Dining Out"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="budget-category">Category</Label>
            <Select name="category" value={category} onValueChange={setCategory} required>
              <SelectTrigger id="budget-category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="budget-amount">Monthly limit ($)</Label>
            <Input
              id="budget-amount"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              defaultValue={budget?.amount}
              placeholder="500"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving..." : isEdit ? "Save changes" : "Create budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
