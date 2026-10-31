import { z } from "zod";
import { DiscountType, DiscountScope } from "@/generated/prisma/enums";

export const createDiscountSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    type: z.nativeEnum(DiscountType),
    value: z.coerce.number().int().min(1, "Value must be at least 1"),
    minPurchase: z.coerce.number().int().min(1).nullable().optional(),
    minQty: z.coerce.number().int().min(1).nullable().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    usageLimit: z.coerce.number().int().min(1, "Usage limit must be at least 1"),
    scope: z.nativeEnum(DiscountScope),
    productIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) => {
      if (data.type === DiscountType.PERCENT) {
        return data.value <= 10000;
      }
      return true;
    },
    {
      message: "Percentage discount cannot exceed 10000 basis points (100%)",
      path: ["value"],
    }
  )
  .refine(
    (data) => {
      if (data.scope === DiscountScope.PRODUCTS) {
        return Array.isArray(data.productIds) && data.productIds.length > 0;
      }
      return true;
    },
    {
      message: "At least one product must be selected for product-scoped discounts",
      path: ["productIds"],
    }
  );

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

export const updateDiscountSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    type: z.nativeEnum(DiscountType).optional(),
    value: z.coerce.number().int().min(1).optional(),
    minPurchase: z.coerce.number().int().min(1).nullable().optional(),
    minQty: z.coerce.number().int().min(1).nullable().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    usageLimit: z.coerce.number().int().min(1).optional(),
    scope: z.nativeEnum(DiscountScope).optional(),
    isActive: z.boolean().optional(),
    productIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) => {
      if (data.type === DiscountType.PERCENT && data.value !== undefined) {
        return data.value <= 10000;
      }
      return true;
    },
    {
      message: "Percentage discount cannot exceed 10000 basis points (100%)",
      path: ["value"],
    }
  );

export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;

export const listDiscountsSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListDiscountsInput = z.infer<typeof listDiscountsSchema>;

export interface LineForDiscount {
  productId: string;
  qty: number;
  amount: number; // paise pre-tax
  unitPrice?: number;
  variantId?: string | null;
}

export interface DiscountCandidate {
  id: string;
  name: string;
  type: DiscountType;
  value: number; // paise if FIXED, bps (0..10000) if PERCENT
  minPurchase?: number | null; // paise pre-tax
  minQty?: number | null;
  startDate: Date | string;
  endDate: Date | string;
  usageLimit: number;
  usedCount: number;
  scope: DiscountScope;
  isActive: boolean;
  productIds?: string[];
  products?: Array<{ productId: string }>;
}

export interface BestDiscountResult {
  discount: DiscountCandidate;
  discountId: string;
  amount: number; // paise
  scope: DiscountScope;
  baseAmount: number; // pre-tax base amount the discount applied to
}
