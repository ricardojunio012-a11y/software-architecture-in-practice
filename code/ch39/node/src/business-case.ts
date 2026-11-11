// The business case: how much the hotspot's debt costs per quarter and how much it
// costs to pay it down, with the cost of delay of a new feature that goes through it.
// The hours come from the history; the rest, from assumptions.json.
import type { Change } from "./git.ts";

export type Assumptions = {
  hourlyRate: number;
  personDayRate: number;
  paydown: { personDays: number; people: number; interestReduction: number };
  payAlong: { personDays: number; interestReduction: number };
  feature: {
    name: string;
    communities: number;
    adoption: number;
    monthlyPrice: number;
    weeksToday: number;
    weeksAfter: number;
  };
};

export type Interest = {
  changesToFile: number;
  hoursInFile: number; // average per change
  hoursElsewhere: number;
  fixesInFile: number; // fraction
  fixesElsewhere: number;
  extraHoursPerQuarter: number;
  interestPerQuarter: number; // $
};

const average = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

// Compares the changes that touch the file with those that do not, over a period.
export function interest(
  changes: Change[],
  file: string,
  quarters: number,
  hourlyRate: number,
): Interest {
  const withHours = changes.filter((c) => c.hours !== null);
  const inFile = withHours.filter((c) => c.files.includes(file));
  const elsewhere = withHours.filter((c) => !c.files.includes(file));
  const isFix = (c: Change) => c.subject.startsWith("fix");
  const hoursInFile = average(inFile.map((c) => c.hours!));
  const hoursElsewhere = average(elsewhere.map((c) => c.hours!));
  const extra = ((hoursInFile - hoursElsewhere) * inFile.length) / quarters;
  return {
    changesToFile: inFile.length,
    hoursInFile,
    hoursElsewhere,
    fixesInFile: inFile.filter(isFix).length / inFile.length,
    fixesElsewhere: elsewhere.filter(isFix).length / elsewhere.length,
    extraHoursPerQuarter: extra,
    interestPerQuarter: extra * hourlyRate,
  };
}

export type Option = {
  name: string;
  weeksToFeature: number;
  paydownCost: number;
  interestPerYear: number;
  featureDelay: number; // $, relative to the fastest option
  total12: number; // cost over 12 months
  total24: number; // cost over 24 months
};

// Three options: don't pay; pay it all down before the feature; pay down, along with
// the feature, the part of the file the feature touches, with the same people.
export function options(i: Interest, a: Assumptions): Option[] {
  const { paydown: pd, payAlong: pa, feature: ft } = a;
  const delayPerWeek = (ft.communities * ft.adoption * ft.monthlyPrice * 12) / 52;
  const weeks = (personDays: number) => personDays / pd.people / 5;
  const interestPerYear = 4 * i.interestPerQuarter;
  const base = [
    {
      name: "don't pay",
      weeksToFeature: ft.weeksToday,
      paydownCost: 0,
      interestPerYear,
    },
    {
      name: "pay first",
      weeksToFeature: weeks(pd.personDays) + ft.weeksAfter,
      paydownCost: pd.personDays * a.personDayRate,
      interestPerYear: interestPerYear * (1 - pd.interestReduction),
    },
    {
      name: "pay along",
      weeksToFeature: weeks(pa.personDays) + ft.weeksAfter,
      paydownCost: pa.personDays * a.personDayRate,
      interestPerYear: interestPerYear * (1 - pa.interestReduction),
    },
  ];
  const fastest = Math.min(...base.map((o) => o.weeksToFeature));
  return base.map((o) => {
    const delay = (o.weeksToFeature - fastest) * delayPerWeek;
    return {
      ...o,
      featureDelay: delay,
      total12: o.paydownCost + o.interestPerYear + delay,
      total24: o.paydownCost + 2 * o.interestPerYear + delay,
    };
  });
}
