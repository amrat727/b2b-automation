import dotenv from 'dotenv';
import fs from 'fs';

/*
 * Settings come from .env in this folder (copy .env.example to .env and fill it in - never commit .env):
 *   B2B_URL=https://b2b.nexgenpilot.com   (agent portal; the live address later)
 *   B2B_COMPANY / B2B_USERNAME / B2B_PASSWORD  - the standing QA agent (company "sb", agent AG-00035)
 * If this repo has no .env yet, the B2B_* values are read from the sibling ../erp-automation/.env.
 */
dotenv.config();
if (!process.env.B2B_PASSWORD && fs.existsSync('../erp-automation/.env')) dotenv.config({ path: '../erp-automation/.env' });

export const B2B_URL = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
export const B2B = {
  company: process.env.B2B_COMPANY ?? '',
  username: process.env.B2B_USERNAME ?? '',
  password: process.env.B2B_PASSWORD ?? '',
};
export const SESSION = 'playwright/.auth/b2b.json';
