import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { stripe } from "@better-auth/stripe";
import prisma from "./db.js";
import { sendAuthEmail } from "./email.js";
import { stripeClient } from "./stripe.js";
import {
  handleStripeInvoicePaid,
  queueDowngradeToFree,
  queueProActivation,
} from "../services/billing.service.js";

const clientUrl = process.env.CLIENT_URL ?? "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeProPriceId = process.env.STRIPE_PRO_PRICE_ID;
const stripeEnabled = Boolean(
  stripeClient && stripeWebhookSecret && stripeProPriceId,
);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? clientUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [clientUrl],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your SourceLab password",
        text: `Click the link to reset your password:\n${url}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your SourceLab email",
        text: `Click the link to verify your email:\n${url}`,
      });
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: stripeEnabled
    ? [
        stripe({
          stripeClient: stripeClient!,
          stripeWebhookSecret: stripeWebhookSecret!,
          createCustomerOnSignUp: true,
          subscription: {
            enabled: true,
            plans: [
              {
                name: "pro",
                priceId: stripeProPriceId!,
              },
            ],
            onSubscriptionComplete: async ({ subscription }) => {
              await queueProActivation(subscription.referenceId);
            },
            onSubscriptionDeleted: async ({ subscription }) => {
              await queueDowngradeToFree(subscription.referenceId);
            },
          },
          onEvent: async (event) => {
            await handleStripeInvoicePaid(event);
          },
        }),
      ]
    : [],
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: isProduction,
      httpOnly: true,
      path: "/",
    },
  },
});
