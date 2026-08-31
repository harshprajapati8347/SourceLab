import { Router } from "express";
import { getBillingMe, listPricingPlans } from "../controllers/billing.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const billingRoutes = Router();

billingRoutes.get("/plans", asyncHandler(listPricingPlans));
billingRoutes.get("/me", requireAuth, asyncHandler(getBillingMe));
