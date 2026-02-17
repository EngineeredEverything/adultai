import { z } from "zod";
import { getImageInfoDataSchema, searchImagesSchema } from "./images";
// import { getPurchaseDataSchema } from "./purchases";
// import { getBillingDetailDataSchema } from "./billingDetails";
// import { getCouponDataSchema } from "./coupons";

// import { create } from "domain";
// import { getProductDataSchema } from "./product";

// user
export const getUserSessionsDataSchema = z.object({
  count: z.optional(z.boolean()),
  limit: z.optional(
    z.object({
      start: z.number(),
      end: z.number(),
    })
  ),
  active: z.optional(z.boolean()),
});

export const getUserImagesDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  private: z.optional(z.boolean()),
});

export const getUserProductViewsDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  // product: z.optional(getProductDataSchema),
});

export const getUserPreferencesDataSchema = z.object({});
export const getUserRolesDataSchema = z.object({});
// order
export const OrderSelectSchema = z.object({
  status: z.boolean().optional(),
  id: z.boolean().optional(),
  billingDetailId: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  userId: z.boolean().optional(),
  finalPrice: z.boolean().optional(),
  totalPrice: z.boolean().optional(),
  totalDiscount: z.boolean().optional(),
  totalShippingPrice: z.boolean().optional(),
  createdAt: z.boolean().optional(),
});
export const getOrderDataSchema = z.object({
  // purchases: getPurchaseDataSchema.optional(),
  // billingDetail: getBillingDetailDataSchema.optional(),
  // coupons: getCouponDataSchema.optional(),
  select: OrderSelectSchema.optional(),
});
export const getUserAccountSchema = z.object({
})
export const getSubscriptionInfoSchema = z.object({
  userId: z.string().optional(), // For admin use
  includeHistory: z.boolean().optional().default(false),
  includeUsage: z.boolean().optional().default(true),
})


export const getUserInfoDataSchema = z.object({
  images: z.optional(getUserImagesDataSchema),
  sessions: z.optional(getUserSessionsDataSchema),
  preferences: z.optional(getUserPreferencesDataSchema),
  role: z.optional(getUserRolesDataSchema),
  productViews: z.optional(getUserProductViewsDataSchema),
  accounts: z.optional(getUserAccountSchema),
  subscription: z.optional(getSubscriptionInfoSchema),
  // generatedImages: z.optional(
  //   searchImagesSchema
  // )
});


///transaction
export const transactionDataSchema = z.object({
  order: getOrderDataSchema.optional(),
  user: z.boolean().optional(),
});
// ticket
export const TicketSelectSchema = z.object({
  status: z.boolean().optional(),
  id: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  userId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  title: z.boolean().optional(),
  description: z.boolean().optional(),
  type: z.boolean().optional(),
  priority: z.boolean().optional(),
  assigneeId: z.boolean().optional(),
});
export const TicketResponseSelectSchema = z.object({
  id: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  userId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  content: z.boolean().optional(),
  verified: z.boolean().optional(),
  currentViewData: z.boolean().optional(),
});
export const TicketReponseFileSelectSchema = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  cdnId: z.boolean().optional(),
  userId: z.boolean().optional(),
  responseId: z.boolean().optional(),
  extension: z.boolean().optional(),
  size: z.boolean().optional(),
  token: z.boolean().optional(),
  verified: z.boolean().optional(),
  cdnLink: z.boolean().optional(),
});
export const TicketResponseViewSelectSchema = z.object({
  id: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  userId: z.boolean().optional(),
  responseId: z.boolean().optional(),
  uses: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  ticketId: z.boolean().optional(),
});
export const getTicketResponseViewDataSchema = z.object({
  select: TicketResponseViewSelectSchema.optional(),
});
export const getTicketResponseFileDataSchema = z.object({
  select: TicketReponseFileSelectSchema.optional(),
});
export const getTicketResponseDataSchema = z.object({
  user: getUserInfoDataSchema.optional(),
  files: getTicketResponseFileDataSchema.optional(),
  select: TicketResponseSelectSchema.optional(),
  views: getTicketResponseViewDataSchema.optional(),
});
export const getTicketResponsesDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  responses: getTicketResponseDataSchema,
});

export const getTicketDataSchema = z.object({
  responses: getTicketResponsesDataSchema.optional(),
  user: getUserInfoDataSchema.optional(),
  select: TicketSelectSchema.optional(),
});

export const getTicketsDataShema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  tickets: getTicketDataSchema,
});
/// points wallet
export const WalletSelectSchema = z.object({
  id: z.boolean().optional(),
  userId: z.boolean().optional(),
  amount: z.boolean().optional(),
  user: z.boolean().optional(),
  transactions: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
});

export const TransactionSelectSchema = z.object({
  id: z.boolean().optional(),
  userId: z.boolean().optional(),
  amount: z.boolean().optional(),
  type: z.boolean().optional(),
  pointsWalletId: z.boolean().optional(),
  user: z.boolean().optional(),
  pointsWallet: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
});
export const getWalletDataSchema = z.object({
  user: getUserInfoDataSchema.optional(),
  select: WalletSelectSchema.optional(),
});

export const getWalletsDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  wallets: getWalletDataSchema.default({}),
});

export const getTransactionDataSchema = z.object({
  user: getUserInfoDataSchema.optional(),
  select: TransactionSelectSchema.optional(),
});

export const getTransactionsDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  transactions: getTransactionDataSchema.default({}),
});
// spin wheel

export const WheelSelectSchema = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  enabled: z.boolean().optional(),
  userDailyLimit: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  expire: z.boolean().optional(),
});

export const PrizeSelectSchema = z.object({
  id: z.boolean().optional(),
  type: z.boolean().optional(),
  name: z.boolean().optional(),
  description: z.boolean().optional(),
  value: z.boolean().optional(),
  probability: z.boolean().optional(),
  wheelId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
});

export const WheelUsageSelectSchema = z.object({
  id: z.boolean().optional(),
  wheelId: z.boolean().optional(),
  userId: z.boolean().optional(),
  prizeId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
});

// Modify the schemas for nested relationships

export const getWheelDataSchema = z.object({
  prizes: z.lazy(() => getPrizesDataSchema).optional(),
  usages: z.lazy(() => getWheelUsagesDataSchema).optional(),
  select: WheelSelectSchema.optional(),
});

export const getPrizeDataSchema = z.object({
  usages: z.lazy(() => getWheelUsagesDataSchema).optional(),
  wheel: z.lazy(() => getWheelDataSchema).optional(), // Add a reference to the Wheel
  select: PrizeSelectSchema.optional(),
});

export const getWheelUsageDataSchema = z.object({
  user: z.any().optional(), // Replace with your user schema if needed
  wheel: z.lazy(() => getWheelDataSchema).optional(), // Add a reference to the Wheel
  prize: z.lazy(() => getPrizeDataSchema).optional(), // Add a reference to the Prize
  select: WheelUsageSelectSchema.optional(),
});

export const getWheelUsagesDataSchema: z.ZodSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  usages: z.array(getWheelUsageDataSchema), // Adjusted to support multiple usages
});

export const getPrizesDataSchema: z.ZodSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  prizes: z.array(getPrizeDataSchema), // Adjusted to support multiple prizes
});

export const getWheelsDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  wheels: z.array(getWheelDataSchema), // Adjusted to support multiple wheels
});
// payslip
export const PayslipFileSelectSchema = z.object({
  id: z.boolean().optional(),
  token: z.boolean().optional(),
  cdnId: z.boolean().optional(),
  name: z.boolean().optional(),
  extension: z.boolean().optional(),
  private: z.boolean().optional(),
  size: z.boolean().optional(),
  verified: z.boolean().optional(),
  payslipId: z.boolean().optional(),
});
export const getPayslipFileDataSchema = z.object({
  select: PayslipFileSelectSchema.optional(),
});
export const getPayslipFilesDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  files: getPayslipFileDataSchema,
});

export const PayslipSelectSchema = z.object({
  id: z.boolean().optional(),
  userId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  acceptedAt: z.boolean().optional(),
  acceptedById: z.boolean().optional(),
  transaction: z.boolean().optional(),
  user: z.boolean().optional(),
  acceptedBy: z.boolean().optional(),
});
export const getPayslipDataSchema = z.object({
  select: PayslipSelectSchema.optional(),
  user: getUserInfoDataSchema.optional(),
  acceptedBy: getUserInfoDataSchema.optional(),
  files: getPayslipFilesDataSchema.optional(),
  transaction: transactionDataSchema.optional(),
});
export const getPayslipsDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  payslips: getPayslipDataSchema,
});
