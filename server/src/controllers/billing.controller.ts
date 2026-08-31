import type { Request, Response } from "express";
import {
  getBillingForUser,
  listPublicPricingPlans,
} from "../services/billing.service.js";

export async function listPricingPlans(_req: Request, res: Response) {
  res.json(listPublicPricingPlans());
}

export async function getBillingMe(req: Request, res: Response) {
  const billing = await getBillingForUser(req.session.user.id);
  res.json(billing);
}
