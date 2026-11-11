// The calculator's table of inputs. Each value says where it came from: a chapter
// of the book, the AWS public price list, or a premise of this lab.
// Replace the values with your company's; the rest of the code only reads this table.
export interface Input {
  value: number;
  unit: string;
  source: string;
}

const i = (value: number, unit: string, source: string): Input => ({
  value,
  unit,
  source,
});

export const INPUTS = {
  // The business
  communities: i(3000, "communities", "ch. 17"),
  subscription: i(300, "$ per community per month", "ch. 17"),
  invoices: i(110, "invoices per community per month", "ch. 25"),
  requests: i(50_000, "requests per community per month", "ch. 34"),
  // Money and people
  hour: i(150, "$ per engineering hour", "ch. 14"),
  person: i(25_200, "$ per person per month", "ch. 32"),
  // AWS prices in N. Virginia, on demand
  node: i(0.0816, "$ per hour, EC2 m7g.large", "ch. 31"),
  cluster: i(0.1, "$ per hour, EKS control plane", "ch. 32"),
  database: i(0.337, "$ per hour, RDS db.m7g.large Multi-AZ", "ch. 17"),
  disk: i(0.23, "$ per GB-month, gp3 Multi-AZ", "ch. 17"),
  // Commitments, in the AWS price list of 10/29/2026 (no upfront payment)
  plan1: i(0.0599, "$ per hour, 1-year Compute Savings Plan", "ch. 40"),
  plan3: i(0.0414, "$ per hour, 3-year Compute Savings Plan", "ch. 40"),
  reserved1: i(0.2595, "$ per hour, RDS reserved for 1 year", "ch. 40"),
  // Costs already calculated in the chapters
  signals: i(173 / 150, "$ per million requests (logs and traces)", "ch. 34"),
  ai: i(0.21, "$ per community, assistant on the smaller model", "ch. 20"),
  backup: i(0.21, "$ per GB-month of backup in another account", "ch. 35"),
  secrets: i(35, "$ per month, secrets vault", "ch. 36"),
  data: i(0.1, "GB per community", "ch. 31"),
  dbHours: i(8, "hours of operation per database per month", "ch. 31"),
  drill: i(800, "$ per database per month, restore drill", "ch. 35"),
  keycloak: i(0.25, "person to operate Keycloak", "ch. 36"),
  pipeline: i(302, "$ per month, pipeline for 40 engineers", "ch. 33"),
  soc2: i(6250, "$ per month, SOC 2 from the 2nd year on", "ch. 37"),
  // Premises of this lab
  perNode: i(1500, "communities per node", "premise"),
  perDatabase: i(4000, "communities on a db.m7g.large", "premise"),
  perAgent: i(1000, "communities per support person", "premise"),
  perPlatform: i(5, "installations per platform person", "premise"),
  installHours: i(8, "hours per installation per month", "premise"),
  perCell: i(3000, "communities per cell", "premise"),
  isolated: i(0.2, "share in management companies that require a silo", "premise"),
  perSilo: i(400, "communities per silo", "ch. 31"),
} satisfies Record<string, Input>;

export const HOURS_PER_MONTH = 730;

export const v = (name: keyof typeof INPUTS): number => INPUTS[name].value;
