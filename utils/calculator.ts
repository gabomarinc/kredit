import { INCOME_BRACKETS } from '../constants';
import { CalculationResult } from '../types';

export const calculateAffordability = (income: number): CalculationResult => {
  // Find the bracket that fits the income. 
  // We reverse find or find last to match the highest possible bracket, 
  // but since the array is sorted by min, find() works if we check logic correctly.
  
  let match = INCOME_BRACKETS.find(b => income >= b.min && income <= b.max);
  
  // If income is higher than the last defined max, take the last one
  if (!match && income > 12000) {
     match = INCOME_BRACKETS[INCOME_BRACKETS.length - 1];
  }

  // If match not found (too low), return 0s
  if (!match) {
    return {
      maxPropertyPrice: 0,
      monthlyPayment: 0,
      downPaymentPercent: 0,
      downPaymentAmount: 0
    };
  }

  return {
    maxPropertyPrice: match.price,
    monthlyPayment: match.monthly,
    downPaymentPercent: match.down,
    downPaymentAmount: match.price * match.down
  };
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};