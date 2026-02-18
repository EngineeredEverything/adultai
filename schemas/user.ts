import * as z from "zod";
// import { getProductsDataSchema, searchProductSchema } from "./product";
import { getUserImagesDataSchema, getUserInfoDataSchema } from "./shared-schemas";

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().optional(),
  system: z.boolean().optional(),
});

// export const createUserImageSchema = z
//   .object({
//     file: z.instanceof(File),
//     private: z.boolean().optional(),
//   })
//   .array();
// export const createUserCombinedSchema = z.object({
//   user: createUserSchema,
//   files: createUserImageSchema.optional(),
// });





export const getUserImagesInfoSchema = z.object({
  userId: z.string(),
  data: getUserImagesDataSchema,
});

export const getUserInfoSchema = z.object({
  userId: z.string(),
  data: getUserInfoDataSchema,
});

export const getCurrentUserInfoSchema = getUserInfoDataSchema;
// searching
export const searchUsersDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  users: getUserInfoDataSchema,
});
export const searchUsersFiltersSchema = z.object({
  role: z.string().array().optional(),
  status: z.string().array().optional(),
  subscription: z.string().array().optional(),
});
export const searchUsersSchema = z.object({
  query: z.string().optional().default(""),
  filters: searchUsersFiltersSchema.optional(),
  data: searchUsersDataSchema,
});
export const updateUserBaseSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  system: z.boolean().optional(),
  roleId: z.string().optional(),

  //   password: z.string().min(6).optional(),
});

export const updateUserPreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  communication: z.array(z.string()).optional(),
  language: z.string().optional(),
  currency: z.string().optional(),
});

export const updateUserImageSchema = z.object({
  imageId: z.string(),
  data: z.object({
    name: z.string().optional(),
    private: z.boolean().optional(),
  }),
});

export const updateUserSessionSchema = z.object({
  sessionId: z.string(),
  data: z.object({
    expires: z.date().optional(),
  }),
});
// export const purchasesDataSchema = z.object({
//     products: z.optional(getProductsDataSchema)
// });

// export const searchPurchasesDataSchema = z.object({
//     limit: z.optional(z.object({
//         start: z.number(),
//         end: z.number()
//     })),
//     count: z.optional(z.boolean()),
//     products: z.optional(getProductsDataSchema)
// });

// export const searchMyPurchasesSchema = z.object({
//     data: searchPurchasesDataSchema
// });

// export const getMyPurchasesSchema = z.object({
//     purchaseIds: z.array(z.string()),
//     data: purchasesDataSchema
// });

// export const getMyTransactionsDataSchema = z.object({
//     limit: z.optional(z.object({
//         start: z.number(),
//         end: z.number()
//     })),
//     count: z.optional(z.boolean()),
//     purchases: z.optional(purchasesDataSchema)
// });
// export const getMyTransactionsFiltersSchema = z.object({
//     status: z.optional(z.nativeEnum(OrderStatus)),

//     dateRange: z.optional(z.object({
//         start: z.date(),
//         end: z.date()
//     }))
// });
// export const getMyTransactionsSchema = z.object({
//     filters: getMyTransactionsFiltersSchema,
//     data: getMyTransactionsDataSchema
// });

// export const getMyOrdersFiltersSchema = z.object({
//     status: z.optional(z.nativeEnum(OrderStatus)),

//     dateRange: z.optional(z.object({
//         start: z.date(),
//         end: z.date()
//     }))
// });
// export const getMyOrdersSchema = z.object({
//     filters: getMyOrdersFiltersSchema,
//     data: getOrdersDataSchema
// });
// export const getMyOrderSchema = z.object({
//     orderId: z.string(),
//     data: getOrdersDataSchema
// });
// export const getMyBillingDetailsDataSchema = z.object({
//     transactions: z.optional(getMyTransactionsDataSchema),
//     orders: z.optional(getOrdersDataSchema)
// });
// export const getMyBillingDetailsSchema = z.object({

//     data: getMyBillingDetailsDataSchema
// });
// export const getMyBillingDetailSchema = z.object({

//     billingDetailId: z.string(),
//     data: getMyBillingDetailsDataSchema
// });
// export const getMyTransactionSchema = z.object({

//     transactionId: z.string(),
//     data: getMyTransactionsDataSchema
// });
